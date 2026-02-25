/**
 * Metrics Persistence Layer
 *
 * Uses sql.js (SQLite compiled to WebAssembly) for zero-native-dependency
 * embedded storage. No C++ toolchain or Visual Studio required.
 *
 * Data is persisted to disk on every write and loaded from disk on startup.
 * Schema supports multi-project observability with indexed queries
 * optimized for the dashboard's primary access patterns.
 *
 * Future: swap this module for a PostgreSQL/Prometheus adapter
 * by implementing the same exported interface.
 */

import initSqlJs, { type Database, type Statement } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.METRICS_DB_PATH || path.join(__dirname, '..', '..', 'data', 'metrics.db');

// ── Types ──

export interface MetricRecord {
  id?: number;
  repository: string;
  project_id: string;
  workflow_run_id: string;
  timestamp: string;
  api_token_hash?: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  status: 'success' | 'failure' | 'partial';
  error_message?: string;
  files_reviewed: number;
  issues_found: number;
  critical_count: number;
  high_count: number;
  model?: string;
  cost_usd: number;
  pr_number?: number;
  branch?: string;
  triggered_by?: string;
  source?: 'ide' | 'pipeline' | 'application';
}

export interface MetricQueryFilters {
  repository?: string;
  project_id?: string;
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface MetricSummary {
  total_runs: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  total_tokens_consumed: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  avg_latency_ms: number;
  avg_tokens_per_run: number;
  total_files_reviewed: number;
  total_issues_found: number;
  total_critical: number;
  total_high: number;
  total_cost_usd: number;
  avg_cost_per_run: number;
  repositories: number;
  projects: number;
}

export interface ProjectInfo {
  project_id: string;
  repository: string;
  run_count: number;
  last_run: string;
  success_rate: number;
  total_cost_usd: number;
}

// ── Database singleton ──

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveToDisk(): void {
  if (!db) return;
  ensureDataDir();
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS workflow_metrics (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      repository      TEXT    NOT NULL,
      project_id      TEXT    NOT NULL,
      workflow_run_id TEXT    NOT NULL,
      timestamp       TEXT    NOT NULL,
      api_token_hash  TEXT,
      request_count   INTEGER NOT NULL DEFAULT 0,
      input_tokens    INTEGER NOT NULL DEFAULT 0,
      output_tokens   INTEGER NOT NULL DEFAULT 0,
      total_tokens    INTEGER NOT NULL DEFAULT 0,
      latency_ms      INTEGER NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'success',
      error_message   TEXT,
      files_reviewed  INTEGER NOT NULL DEFAULT 0,
      issues_found    INTEGER NOT NULL DEFAULT 0,
      critical_count  INTEGER NOT NULL DEFAULT 0,
      high_count      INTEGER NOT NULL DEFAULT 0,
      model           TEXT,
      cost_usd        REAL    NOT NULL DEFAULT 0,
      pr_number       INTEGER,
      branch          TEXT,
      triggered_by    TEXT,
      source          TEXT    NOT NULL DEFAULT 'pipeline'
    )
  `);
  database.run(`CREATE INDEX IF NOT EXISTS idx_metrics_repo       ON workflow_metrics(repository)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_metrics_project    ON workflow_metrics(project_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp  ON workflow_metrics(timestamp)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_metrics_status     ON workflow_metrics(status)`);

  // Migrations for existing databases
  try {
    const cols = database.exec('PRAGMA table_info(workflow_metrics)');
    const colNames = cols[0]?.values.map((row: unknown[]) => row[1]) ?? [];
    if (!colNames.includes('cost_usd')) {
      database.run('ALTER TABLE workflow_metrics ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0');
      console.log('[METRICS-DB] Migrated: added cost_usd column');
    }
    if (!colNames.includes('source')) {
      database.run("ALTER TABLE workflow_metrics ADD COLUMN source TEXT NOT NULL DEFAULT 'pipeline'");
      console.log('[METRICS-DB] Migrated: added source column');
    }
  } catch {
    // Safe to ignore — columns already exist
  }
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    ensureDataDir();

    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log(`[METRICS-DB] Loaded existing database from ${DB_PATH}`);
    } else {
      db = new SQL.Database();
      console.log(`[METRICS-DB] Created new database at ${DB_PATH}`);
    }

    initSchema(db);
    saveToDisk();
    return db;
  })();

  return initPromise;
}

// ── Helper: convert sql.js Statement rows to objects ──

function stmtToObjects<T>(stmt: Statement): T[] {
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// ── CRUD Operations ──

export async function insertMetric(metric: Omit<MetricRecord, 'id'>): Promise<MetricRecord> {
  const database = await getDatabase();

  database.run(
    `INSERT INTO workflow_metrics (
      repository, project_id, workflow_run_id, timestamp,
      api_token_hash, request_count, input_tokens, output_tokens, total_tokens,
      latency_ms, status, error_message, files_reviewed, issues_found,
      critical_count, high_count, model, cost_usd, pr_number, branch, triggered_by, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      metric.repository,
      metric.project_id,
      metric.workflow_run_id,
      metric.timestamp || new Date().toISOString(),
      metric.api_token_hash ?? null,
      metric.request_count,
      metric.input_tokens,
      metric.output_tokens,
      metric.total_tokens,
      metric.latency_ms,
      metric.status,
      metric.error_message ?? null,
      metric.files_reviewed,
      metric.issues_found,
      metric.critical_count,
      metric.high_count,
      metric.model ?? null,
      metric.cost_usd,
      metric.pr_number ?? null,
      metric.branch ?? null,
      metric.triggered_by ?? null,
      metric.source ?? 'pipeline',
    ],
  );

  // Retrieve the auto-incremented id
  const idStmt = database.prepare('SELECT last_insert_rowid() AS id');
  idStmt.step();
  const { id } = idStmt.getAsObject() as { id: number };
  idStmt.free();

  saveToDisk();

  return { ...metric, id };
}

export async function queryMetrics(filters: MetricQueryFilters): Promise<MetricRecord[]> {
  const database = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.repository) {
    conditions.push('repository = ?');
    params.push(filters.repository);
  }
  if (filters.project_id) {
    conditions.push('project_id = ?');
    params.push(filters.project_id);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.source) {
    conditions.push('source = ?');
    params.push(filters.source);
  }
  if (filters.from) {
    conditions.push('timestamp >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('timestamp <= ?');
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  params.push(limit, offset);

  const stmt = database.prepare(`
    SELECT * FROM workflow_metrics
    ${where}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);
  stmt.bind(params);

  return stmtToObjects<MetricRecord>(stmt);
}

export async function getMetricsSummary(
  filters: Pick<MetricQueryFilters, 'repository' | 'project_id' | 'source' | 'from' | 'to'>,
): Promise<MetricSummary> {
  const database = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.repository) {
    conditions.push('repository = ?');
    params.push(filters.repository);
  }
  if (filters.project_id) {
    conditions.push('project_id = ?');
    params.push(filters.project_id);
  }
  if (filters.source) {
    conditions.push('source = ?');
    params.push(filters.source);
  }
  if (filters.from) {
    conditions.push('timestamp >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('timestamp <= ?');
    params.push(filters.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const stmt = database.prepare(`
    SELECT
      COUNT(*)                                                  AS total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)      AS success_count,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END)      AS failure_count,
      COALESCE(SUM(total_tokens), 0)                            AS total_tokens_consumed,
      COALESCE(SUM(input_tokens), 0)                            AS total_input_tokens,
      COALESCE(SUM(output_tokens), 0)                           AS total_output_tokens,
      COALESCE(SUM(request_count), 0)                           AS total_requests,
      COALESCE(ROUND(AVG(latency_ms)), 0)                       AS avg_latency_ms,
      COALESCE(SUM(files_reviewed), 0)                          AS total_files_reviewed,
      COALESCE(SUM(issues_found), 0)                            AS total_issues_found,
      COALESCE(SUM(critical_count), 0)                          AS total_critical,
      COALESCE(SUM(high_count), 0)                              AS total_high,
      COALESCE(SUM(cost_usd), 0)                                AS total_cost_usd,
      COUNT(DISTINCT repository)                                AS repositories,
      COUNT(DISTINCT project_id)                                AS projects
    FROM workflow_metrics
    ${where}
  `);
  stmt.bind(params);
  stmt.step();
  const row = stmt.getAsObject() as Record<string, number>;
  stmt.free();

  const totalRuns = row.total_runs || 0;

  return {
    total_runs: totalRuns,
    success_count: row.success_count || 0,
    failure_count: row.failure_count || 0,
    success_rate: totalRuns > 0 ? Math.round((row.success_count / totalRuns) * 100) : 0,
    total_tokens_consumed: row.total_tokens_consumed,
    total_input_tokens: row.total_input_tokens,
    total_output_tokens: row.total_output_tokens,
    total_requests: row.total_requests,
    avg_latency_ms: row.avg_latency_ms,
    avg_tokens_per_run: totalRuns > 0 ? Math.round(row.total_tokens_consumed / totalRuns) : 0,
    total_files_reviewed: row.total_files_reviewed,
    total_issues_found: row.total_issues_found,
    total_critical: row.total_critical,
    total_high: row.total_high,
    total_cost_usd: Math.round(row.total_cost_usd * 1_000_000) / 1_000_000,
    avg_cost_per_run: totalRuns > 0 ? Math.round((row.total_cost_usd / totalRuns) * 1_000_000) / 1_000_000 : 0,
    repositories: row.repositories,
    projects: row.projects,
  };
}

export async function getProjects(): Promise<ProjectInfo[]> {
  const database = await getDatabase();

  const stmt = database.prepare(`
    SELECT
      project_id,
      repository,
      COUNT(*)                                                        AS run_count,
      MAX(timestamp)                                                  AS last_run,
      ROUND(
        SUM(CASE WHEN status = 'success' THEN 1.0 ELSE 0 END) / COUNT(*) * 100
      )                                                               AS success_rate,
      COALESCE(SUM(cost_usd), 0)                                      AS total_cost_usd
    FROM workflow_metrics
    GROUP BY project_id, repository
    ORDER BY last_run DESC
  `);

  return stmtToObjects<ProjectInfo>(stmt);
}

export function closeDatabase(): void {
  if (db) {
    saveToDisk();
    db.close();
    db = null;
    initPromise = null;
  }
}
