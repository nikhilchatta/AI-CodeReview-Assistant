/**
 * Run Details Persistence Layer
 *
 * Stores full per-run drill-down data for the Observability dashboard:
 * validation failures, LLM findings, per-file results, severity breakdown,
 * actor, commit SHA, PR number, and more.
 *
 * Uses the same sql.js (SQLite/WASM) database as metrics.ts.
 * Schema is additive — existing workflow_metrics table is untouched.
 */

import { getDatabase } from './metrics.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Types ──────────────────────────────────────────────────────────────────

export interface ValidationFailure {
  rule_id?: string;
  severity: string;
  category: string;
  message: string;
  suggestion: string;
  file: string;
  line_number?: number;
}

export interface LLMFinding {
  severity: string;
  category: string;
  message: string;
  suggestion: string;
  reasoning?: string;
  file: string;
  line_number?: number;
}

export interface PerFileResult {
  file: string;
  language: string;
  validation_count: number;
  llm_count: number;
  issues: Array<{
    severity: string;
    category: string;
    message: string;
    suggestion?: string;
    reasoning?: string;
    line_number?: number;
  }>;
  error?: string;
}

export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface RunDetail {
  id?: number;
  run_id: string;
  metric_id?: number;
  repository: string;
  pr_number?: number;
  commit_sha?: string;
  actor?: string;
  branch?: string;
  base_branch?: string;
  workflow_run_id: string;
  project_id?: string;
  gate_status: 'pass' | 'fail';
  status: 'success' | 'failure' | 'partial';
  validation_failures: ValidationFailure[];
  llm_findings: LLMFinding[];
  per_file_results: PerFileResult[];
  severity_distribution: SeverityDistribution;
  total_issues: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  files_reviewed: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  model?: string;
  latency_ms: number;
  timestamp: string;
  runtime_ms: number;
}

export interface RunDetailQuery {
  repository?: string;
  project_id?: string;
  status?: string;
  gate_status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ── Schema ─────────────────────────────────────────────────────────────────

export async function ensureRunDetailsSchema(): Promise<void> {
  const db = await getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS run_details (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id                TEXT    NOT NULL UNIQUE,
      metric_id             INTEGER,
      repository            TEXT    NOT NULL,
      pr_number             INTEGER,
      commit_sha            TEXT,
      actor                 TEXT,
      branch                TEXT,
      base_branch           TEXT,
      workflow_run_id       TEXT    NOT NULL,
      project_id            TEXT,
      gate_status           TEXT    NOT NULL DEFAULT 'pass',
      status                TEXT    NOT NULL DEFAULT 'success',
      validation_failures   TEXT    NOT NULL DEFAULT '[]',
      llm_findings          TEXT    NOT NULL DEFAULT '[]',
      per_file_results      TEXT    NOT NULL DEFAULT '[]',
      severity_distribution TEXT    NOT NULL DEFAULT '{}',
      total_issues          INTEGER NOT NULL DEFAULT 0,
      critical_count        INTEGER NOT NULL DEFAULT 0,
      high_count            INTEGER NOT NULL DEFAULT 0,
      medium_count          INTEGER NOT NULL DEFAULT 0,
      low_count             INTEGER NOT NULL DEFAULT 0,
      files_reviewed        INTEGER NOT NULL DEFAULT 0,
      input_tokens          INTEGER NOT NULL DEFAULT 0,
      output_tokens         INTEGER NOT NULL DEFAULT 0,
      total_tokens          INTEGER NOT NULL DEFAULT 0,
      cost_usd              REAL    NOT NULL DEFAULT 0,
      model                 TEXT,
      latency_ms            INTEGER NOT NULL DEFAULT 0,
      timestamp             TEXT    NOT NULL,
      runtime_ms            INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_run_details_run_id     ON run_details(run_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_run_details_repo       ON run_details(repository)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_run_details_project    ON run_details(project_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_run_details_timestamp  ON run_details(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_run_details_gate       ON run_details(gate_status)`);

  // Persist schema creation
  const dbPath = process.env.METRICS_DB_PATH || path.join(__dirname, '..', '..', 'data', 'metrics.db');
  const data = db.export();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(data));

  console.log('[RUN-DETAILS-DB] Schema ensured');
}

// ── Save to disk helper ────────────────────────────────────────────────────

function saveToDisk(db: any): void {
  const dbPath = process.env.METRICS_DB_PATH || path.join(__dirname, '..', '..', 'data', 'metrics.db');
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function insertRunDetail(detail: Omit<RunDetail, 'id'>): Promise<RunDetail> {
  const db = await getDatabase();

  db.run(
    `INSERT OR REPLACE INTO run_details (
      run_id, metric_id, repository, pr_number, commit_sha, actor,
      branch, base_branch, workflow_run_id, project_id,
      gate_status, status,
      validation_failures, llm_findings, per_file_results, severity_distribution,
      total_issues, critical_count, high_count, medium_count, low_count,
      files_reviewed, input_tokens, output_tokens, total_tokens,
      cost_usd, model, latency_ms, timestamp, runtime_ms
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )`,
    [
      detail.run_id,
      detail.metric_id ?? null,
      detail.repository,
      detail.pr_number ?? null,
      detail.commit_sha ?? null,
      detail.actor ?? null,
      detail.branch ?? null,
      detail.base_branch ?? null,
      detail.workflow_run_id,
      detail.project_id ?? null,
      detail.gate_status,
      detail.status,
      JSON.stringify(detail.validation_failures),
      JSON.stringify(detail.llm_findings),
      JSON.stringify(detail.per_file_results),
      JSON.stringify(detail.severity_distribution),
      detail.total_issues,
      detail.critical_count,
      detail.high_count,
      detail.medium_count,
      detail.low_count,
      detail.files_reviewed,
      detail.input_tokens,
      detail.output_tokens,
      detail.total_tokens,
      detail.cost_usd,
      detail.model ?? null,
      detail.latency_ms,
      detail.timestamp || new Date().toISOString(),
      detail.runtime_ms,
    ],
  );

  const idStmt = db.prepare('SELECT last_insert_rowid() AS id');
  idStmt.step();
  const { id } = idStmt.getAsObject() as { id: number };
  idStmt.free();

  saveToDisk(db);

  console.log(`[RUN-DETAILS-DB] Stored run detail ${detail.run_id} (gate=${detail.gate_status})`);
  return { ...detail, id };
}

export async function getRunDetail(runId: string): Promise<RunDetail | null> {
  const db = await getDatabase();

  const stmt = db.prepare('SELECT * FROM run_details WHERE run_id = ?');
  stmt.bind([runId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, any>;
  stmt.free();

  return deserializeRunDetail(row);
}

export async function queryRunDetails(filters: RunDetailQuery): Promise<RunDetail[]> {
  const db = await getDatabase();
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
  if (filters.gate_status) {
    conditions.push('gate_status = ?');
    params.push(filters.gate_status);
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
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  params.push(limit, offset);

  const stmt = db.prepare(`
    SELECT * FROM run_details
    ${where}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);
  stmt.bind(params);

  const results: RunDetail[] = [];
  while (stmt.step()) {
    results.push(deserializeRunDetail(stmt.getAsObject() as Record<string, any>));
  }
  stmt.free();

  return results;
}

// ── Deserializer ───────────────────────────────────────────────────────────

function deserializeRunDetail(row: Record<string, any>): RunDetail {
  return {
    id: row.id,
    run_id: row.run_id,
    metric_id: row.metric_id ?? undefined,
    repository: row.repository,
    pr_number: row.pr_number ?? undefined,
    commit_sha: row.commit_sha ?? undefined,
    actor: row.actor ?? undefined,
    branch: row.branch ?? undefined,
    base_branch: row.base_branch ?? undefined,
    workflow_run_id: row.workflow_run_id,
    project_id: row.project_id ?? undefined,
    gate_status: row.gate_status,
    status: row.status,
    validation_failures: safeParseJSON(row.validation_failures, []),
    llm_findings: safeParseJSON(row.llm_findings, []),
    per_file_results: safeParseJSON(row.per_file_results, []),
    severity_distribution: safeParseJSON(row.severity_distribution, { critical: 0, high: 0, medium: 0, low: 0, info: 0 }),
    total_issues: row.total_issues,
    critical_count: row.critical_count,
    high_count: row.high_count,
    medium_count: row.medium_count,
    low_count: row.low_count,
    files_reviewed: row.files_reviewed,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    total_tokens: row.total_tokens,
    cost_usd: row.cost_usd,
    model: row.model ?? undefined,
    latency_ms: row.latency_ms,
    timestamp: row.timestamp,
    runtime_ms: row.runtime_ms,
  };
}

function safeParseJSON<T>(raw: any, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
