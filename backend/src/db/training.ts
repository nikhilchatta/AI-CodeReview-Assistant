/**
 * Training Data Persistence Layer
 *
 * Three append-only tables that build a continuously growing dataset of real
 * code review behaviour for model training and drift analysis.
 *
 *   training_records   — one row per review run; immutable after insert
 *   training_feedback  — human feedback rows; append-only, never updated
 *   training_labels    — computed precision/recall/RL labels; rewritten on
 *                        each new feedback submission for a given record
 *
 * Shares the same sql.js database singleton used by metrics.ts and
 * run-details.ts. Schema is additive — existing tables are untouched.
 */

import { getDatabase } from './metrics.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TrainingRecord {
  id?: number;
  run_id: string;
  schema_version: string;
  created_at: string;
  repository: string;
  commit_sha?: string;
  pr_number?: number;
  branch?: string;
  base_branch?: string;
  actor?: string;
  workflow_run_id: string;
  project_id?: string;
  full_diff?: string;
  files_reviewed_json: string;       // JSON array of { path, language, content }
  rendered_prompt?: string;          // last LLM prompt used verbatim
  prompt_template_version: string;
  validation_rules_config: string;   // JSON snapshot of active rules config
  model_version?: string;
  analysis_type?: string;
  validation_failures: string;       // JSON
  llm_findings: string;              // JSON
  per_file_results: string;          // JSON
  severity_breakdown: string;        // JSON
  gate_status: 'pass' | 'fail';
  status: string;
  total_issues: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  source: string;
}

export interface TrainingFeedback {
  id?: number;
  record_id: number;
  run_id: string;
  finding_index?: number;            // null = gate-level feedback
  finding_type?: 'validation' | 'llm' | 'gate';
  action: 'accept' | 'reject' | 'modify';
  reason?: string;
  corrected_findings: string;        // JSON array; populated when action='modify'
  reviewer_id?: string;
  feedback_channel: 'gh' | 'dashboard' | 'pr';
  created_at: string;
}

export interface TrainingLabels {
  id?: number;
  record_id: number;
  run_id: string;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision_score?: number;
  recall_score?: number;
  gate_correct?: number;             // 0 | 1 | null
  rl_reward?: number;                // -1.0 to +1.0
  supervised_label?: 'correct' | 'false_positive' | 'false_negative' | 'partial';
  computed_at: string;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

export async function ensureTrainingSchema(): Promise<void> {
  const db = await getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS training_records (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id                  TEXT    NOT NULL UNIQUE,
      schema_version          TEXT    NOT NULL DEFAULT '1.0',
      created_at              TEXT    NOT NULL,
      repository              TEXT    NOT NULL,
      commit_sha              TEXT,
      pr_number               INTEGER,
      branch                  TEXT,
      base_branch             TEXT,
      actor                   TEXT,
      workflow_run_id         TEXT    NOT NULL,
      project_id              TEXT,
      full_diff               TEXT,
      files_reviewed_json     TEXT    NOT NULL DEFAULT '[]',
      rendered_prompt         TEXT,
      prompt_template_version TEXT    NOT NULL DEFAULT '1.0',
      validation_rules_config TEXT    NOT NULL DEFAULT '{}',
      model_version           TEXT,
      analysis_type           TEXT,
      validation_failures     TEXT    NOT NULL DEFAULT '[]',
      llm_findings            TEXT    NOT NULL DEFAULT '[]',
      per_file_results        TEXT    NOT NULL DEFAULT '[]',
      severity_breakdown      TEXT    NOT NULL DEFAULT '{}',
      gate_status             TEXT    NOT NULL DEFAULT 'pass',
      status                  TEXT    NOT NULL DEFAULT 'success',
      total_issues            INTEGER NOT NULL DEFAULT 0,
      input_tokens            INTEGER NOT NULL DEFAULT 0,
      output_tokens           INTEGER NOT NULL DEFAULT 0,
      total_tokens            INTEGER NOT NULL DEFAULT 0,
      cost_usd                REAL    NOT NULL DEFAULT 0,
      latency_ms              INTEGER NOT NULL DEFAULT 0,
      source                  TEXT    NOT NULL DEFAULT 'pipeline'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS training_feedback (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id          INTEGER NOT NULL,
      run_id             TEXT    NOT NULL,
      finding_index      INTEGER,
      finding_type       TEXT,
      action             TEXT    NOT NULL,
      reason             TEXT,
      corrected_findings TEXT    NOT NULL DEFAULT '[]',
      reviewer_id        TEXT,
      feedback_channel   TEXT    NOT NULL DEFAULT 'dashboard',
      created_at         TEXT    NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS training_labels (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id        INTEGER NOT NULL UNIQUE,
      run_id           TEXT    NOT NULL UNIQUE,
      true_positives   INTEGER NOT NULL DEFAULT 0,
      false_positives  INTEGER NOT NULL DEFAULT 0,
      false_negatives  INTEGER NOT NULL DEFAULT 0,
      precision_score  REAL,
      recall_score     REAL,
      gate_correct     INTEGER,
      rl_reward        REAL,
      supervised_label TEXT,
      computed_at      TEXT    NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_training_records_run_id    ON training_records(run_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_records_repo      ON training_records(repository)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_records_created   ON training_records(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_records_model     ON training_records(model_version)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_feedback_record   ON training_feedback(record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_feedback_run_id   ON training_feedback(run_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_training_labels_run_id     ON training_labels(run_id)`);

  saveToDisk(db);
  console.log('[TRAINING-DB] Schema ensured');
}

// ── Disk helper ────────────────────────────────────────────────────────────────

function saveToDisk(db: any): void {
  const dbPath =
    process.env.METRICS_DB_PATH ||
    path.join(__dirname, '..', '..', 'data', 'metrics.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

// ── Insert training record (called from pr-review.ts) ─────────────────────────

export async function insertTrainingRecord(
  record: Omit<TrainingRecord, 'id'>,
): Promise<number> {
  const db = await getDatabase();

  db.run(
    `INSERT OR IGNORE INTO training_records (
      run_id, schema_version, created_at, repository, commit_sha, pr_number,
      branch, base_branch, actor, workflow_run_id, project_id,
      full_diff, files_reviewed_json, rendered_prompt,
      prompt_template_version, validation_rules_config,
      model_version, analysis_type,
      validation_failures, llm_findings, per_file_results, severity_breakdown,
      gate_status, status, total_issues,
      input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, source
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )`,
    [
      record.run_id,
      record.schema_version,
      record.created_at,
      record.repository,
      record.commit_sha ?? null,
      record.pr_number ?? null,
      record.branch ?? null,
      record.base_branch ?? null,
      record.actor ?? null,
      record.workflow_run_id,
      record.project_id ?? null,
      record.full_diff ?? null,
      record.files_reviewed_json,
      record.rendered_prompt ?? null,
      record.prompt_template_version,
      record.validation_rules_config,
      record.model_version ?? null,
      record.analysis_type ?? null,
      record.validation_failures,
      record.llm_findings,
      record.per_file_results,
      record.severity_breakdown,
      record.gate_status,
      record.status,
      record.total_issues,
      record.input_tokens,
      record.output_tokens,
      record.total_tokens,
      record.cost_usd,
      record.latency_ms,
      record.source,
    ],
  );

  const idStmt = db.prepare('SELECT last_insert_rowid() AS id');
  idStmt.step();
  const { id } = idStmt.getAsObject() as { id: number };
  idStmt.free();

  saveToDisk(db);
  console.log(`[TRAINING-DB] Stored training record for run ${record.run_id}`);
  return id;
}

// ── Get training record id by run_id ──────────────────────────────────────────

export async function getTrainingRecordIdByRunId(
  runId: string,
): Promise<number | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT id FROM training_records WHERE run_id = ?');
  stmt.bind([runId]);
  if (!stmt.step()) { stmt.free(); return null; }
  const { id } = stmt.getAsObject() as { id: number };
  stmt.free();
  return id;
}

// ── Insert feedback row (append-only) ─────────────────────────────────────────

export async function insertTrainingFeedback(
  feedback: Omit<TrainingFeedback, 'id'>,
): Promise<number> {
  const db = await getDatabase();

  db.run(
    `INSERT INTO training_feedback (
      record_id, run_id, finding_index, finding_type,
      action, reason, corrected_findings,
      reviewer_id, feedback_channel, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      feedback.record_id,
      feedback.run_id,
      feedback.finding_index ?? null,
      feedback.finding_type ?? null,
      feedback.action,
      feedback.reason ?? null,
      feedback.corrected_findings,
      feedback.reviewer_id ?? null,
      feedback.feedback_channel,
      feedback.created_at,
    ],
  );

  const idStmt = db.prepare('SELECT last_insert_rowid() AS id');
  idStmt.step();
  const { id } = idStmt.getAsObject() as { id: number };
  idStmt.free();

  saveToDisk(db);
  console.log(
    `[TRAINING-DB] Feedback recorded for run ${feedback.run_id}: ` +
    `${feedback.action} (channel=${feedback.feedback_channel})`,
  );
  return id;
}

// ── Compute and upsert training labels ────────────────────────────────────────
// Called after every feedback insertion to keep labels current.

export async function computeAndStoreLabels(
  recordId: number,
  runId: string,
): Promise<void> {
  const db = await getDatabase();

  // Fetch all feedback rows for this record
  const fbStmt = db.prepare(
    'SELECT action, finding_type FROM training_feedback WHERE record_id = ?',
  );
  fbStmt.bind([recordId]);

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let gateAccepts = 0;
  let gateTotals = 0;

  while (fbStmt.step()) {
    const row = fbStmt.getAsObject() as { action: string; finding_type: string };
    if (row.finding_type === 'gate') {
      gateTotals++;
      if (row.action === 'accept') gateAccepts++;
    } else {
      if (row.action === 'accept')  truePositives++;
      if (row.action === 'reject')  falsePositives++;
      if (row.action === 'modify')  falseNegatives++;  // correction implies AI was wrong
    }
  }
  fbStmt.free();

  const total = truePositives + falsePositives;
  const precisionScore = total > 0 ? truePositives / total : null;
  const recallDenom   = truePositives + falseNegatives;
  const recallScore   = recallDenom > 0 ? truePositives / recallDenom : null;
  const gateCorrect   = gateTotals > 0 ? (gateAccepts === gateTotals ? 1 : 0) : null;
  const rlReward      = total > 0 ? (truePositives - falsePositives) / total : null;

  let supervisedLabel: string | null = null;
  if (total > 0 || falseNegatives > 0) {
    if (falsePositives === 0 && falseNegatives === 0 && truePositives > 0) {
      supervisedLabel = 'correct';
    } else if (falsePositives > 0 && truePositives === 0 && falseNegatives === 0) {
      supervisedLabel = 'false_positive';
    } else if (falseNegatives > 0 && truePositives === 0 && falsePositives === 0) {
      supervisedLabel = 'false_negative';
    } else {
      supervisedLabel = 'partial';
    }
  } else if (gateCorrect !== null) {
    supervisedLabel = gateCorrect === 1 ? 'correct' : 'false_positive';
  }

  const computedAt = new Date().toISOString();

  db.run(
    `INSERT INTO training_labels (
      record_id, run_id,
      true_positives, false_positives, false_negatives,
      precision_score, recall_score, gate_correct,
      rl_reward, supervised_label, computed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(record_id) DO UPDATE SET
      true_positives  = excluded.true_positives,
      false_positives = excluded.false_positives,
      false_negatives = excluded.false_negatives,
      precision_score = excluded.precision_score,
      recall_score    = excluded.recall_score,
      gate_correct    = excluded.gate_correct,
      rl_reward       = excluded.rl_reward,
      supervised_label = excluded.supervised_label,
      computed_at     = excluded.computed_at`,
    [
      recordId,
      runId,
      truePositives,
      falsePositives,
      falseNegatives,
      precisionScore,
      recallScore,
      gateCorrect,
      rlReward,
      supervisedLabel,
      computedAt,
    ],
  );

  saveToDisk(db);
  console.log(
    `[TRAINING-DB] Labels computed for ${runId}: ` +
    `TP=${truePositives} FP=${falsePositives} FN=${falseNegatives} ` +
    `label=${supervisedLabel ?? 'none'} reward=${rlReward?.toFixed(2) ?? 'n/a'}`,
  );
}

// ── Export query ───────────────────────────────────────────────────────────────

export interface TrainingExportFilters {
  labeled?: boolean;
  model_version?: string;
  from?: string;
  to?: string;
  repository?: string;
  limit?: number;
  offset?: number;
}

export async function exportTrainingRecords(
  filters: TrainingExportFilters = {},
): Promise<object[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.model_version) {
    conditions.push('r.model_version = ?');
    params.push(filters.model_version);
  }
  if (filters.repository) {
    conditions.push('r.repository = ?');
    params.push(filters.repository);
  }
  if (filters.from) {
    conditions.push('r.created_at >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('r.created_at <= ?');
    params.push(filters.to);
  }
  if (filters.labeled) {
    // Only records that have at least one feedback row
    conditions.push('EXISTS (SELECT 1 FROM training_feedback f WHERE f.record_id = r.id)');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit  = filters.limit  ?? 500;
  const offset = filters.offset ?? 0;
  params.push(limit, offset);

  const stmt = db.prepare(`
    SELECT
      r.*,
      l.true_positives,  l.false_positives,  l.false_negatives,
      l.precision_score, l.recall_score,     l.gate_correct,
      l.rl_reward,       l.supervised_label, l.computed_at AS labels_computed_at
    FROM training_records r
    LEFT JOIN training_labels l ON l.record_id = r.id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `);
  stmt.bind(params);

  const records: object[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, any>;

    // Fetch all feedback rows for this record
    const fbStmt = db.prepare(
      'SELECT action, finding_index, finding_type, reason, corrected_findings, reviewer_id, feedback_channel, created_at FROM training_feedback WHERE record_id = ? ORDER BY created_at ASC',
    );
    fbStmt.bind([row.id]);
    const feedbackRows: object[] = [];
    while (fbStmt.step()) {
      const fb = fbStmt.getAsObject() as Record<string, any>;
      feedbackRows.push({
        action:              fb.action,
        finding_index:       fb.finding_index,
        finding_type:        fb.finding_type,
        reason:              fb.reason,
        corrected_findings:  safeParseJSON(fb.corrected_findings, []),
        reviewer_id:         fb.reviewer_id,
        feedback_channel:    fb.feedback_channel,
        created_at:          fb.created_at,
      });
    }
    fbStmt.free();

    records.push({
      schema_version:          row.schema_version,
      id:                      row.id,
      run_id:                  row.run_id,
      created_at:              row.created_at,
      repository:              row.repository,
      commit_sha:              row.commit_sha,
      pr_number:               row.pr_number,
      branch:                  row.branch,
      base_branch:             row.base_branch,
      actor:                   row.actor,
      workflow_run_id:         row.workflow_run_id,
      project_id:              row.project_id,
      full_diff:               row.full_diff,
      files_reviewed:          safeParseJSON(row.files_reviewed_json, []),
      rendered_prompt:         row.rendered_prompt,
      prompt_template_version: row.prompt_template_version,
      validation_rules_config: safeParseJSON(row.validation_rules_config, {}),
      model_version:           row.model_version,
      analysis_type:           row.analysis_type,
      validation_failures:     safeParseJSON(row.validation_failures, []),
      llm_findings:            safeParseJSON(row.llm_findings, []),
      per_file_results:        safeParseJSON(row.per_file_results, []),
      severity_breakdown:      safeParseJSON(row.severity_breakdown, {}),
      gate_status:             row.gate_status,
      status:                  row.status,
      total_issues:            row.total_issues,
      input_tokens:            row.input_tokens,
      output_tokens:           row.output_tokens,
      total_tokens:            row.total_tokens,
      cost_usd:                row.cost_usd,
      latency_ms:              row.latency_ms,
      source:                  row.source,
      human_feedback:          feedbackRows,
      outcome_labels: row.supervised_label != null ? {
        true_positives:   row.true_positives,
        false_positives:  row.false_positives,
        false_negatives:  row.false_negatives,
        precision:        row.precision_score,
        recall:           row.recall_score,
        gate_correct:     row.gate_correct === 1,
        rl_reward:        row.rl_reward,
        supervised_label: row.supervised_label,
        computed_at:      row.labels_computed_at,
      } : null,
    });
  }
  stmt.free();

  return records;
}

// ── Training Stats ─────────────────────────────────────────────────────────────

export interface TrainingStats {
  total_records: number;
  labeled_records: number;
  total_feedback: number;
  feedback_by_channel: { dashboard: number; gh: number; pr: number };
  feedback_by_action: { accept: number; reject: number; modify: number };
  label_distribution: {
    correct: number;
    false_positive: number;
    false_negative: number;
    partial: number;
  };
  avg_precision: number | null;
  avg_recall: number | null;
  avg_rl_reward: number | null;
}

export async function getTrainingStats(): Promise<TrainingStats> {
  const db = await getDatabase();

  const one = (sql: string, params: (string | number)[] = []): Record<string, any> => {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const result: Record<string, any> = stmt.step() ? (stmt.getAsObject() as Record<string, any>) : {};
    stmt.free();
    return result;
  };

  const all = (sql: string, params: (string | number)[] = []): Record<string, any>[] => {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows: Record<string, any>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, any>);
    stmt.free();
    return rows;
  };

  const totalRecords   = (one('SELECT COUNT(*) AS cnt FROM training_records')).cnt  ?? 0;
  const labeledRecords = (one('SELECT COUNT(*) AS cnt FROM training_labels')).cnt   ?? 0;
  const totalFeedback  = (one('SELECT COUNT(*) AS cnt FROM training_feedback')).cnt ?? 0;

  const feedback_by_channel: { dashboard: number; gh: number; pr: number } = { dashboard: 0, gh: 0, pr: 0 };
  for (const r of all('SELECT feedback_channel, COUNT(*) AS cnt FROM training_feedback GROUP BY feedback_channel')) {
    (feedback_by_channel as any)[r.feedback_channel] = r.cnt;
  }

  const feedback_by_action: { accept: number; reject: number; modify: number } = { accept: 0, reject: 0, modify: 0 };
  for (const r of all('SELECT action, COUNT(*) AS cnt FROM training_feedback GROUP BY action')) {
    (feedback_by_action as any)[r.action] = r.cnt;
  }

  const label_distribution: { correct: number; false_positive: number; false_negative: number; partial: number } =
    { correct: 0, false_positive: 0, false_negative: 0, partial: 0 };
  for (const r of all(
    'SELECT supervised_label, COUNT(*) AS cnt FROM training_labels WHERE supervised_label IS NOT NULL GROUP BY supervised_label',
  )) {
    (label_distribution as any)[r.supervised_label] = r.cnt;
  }

  const avgRow = one(
    'SELECT AVG(precision_score) AS avg_p, AVG(recall_score) AS avg_r, AVG(rl_reward) AS avg_rl FROM training_labels',
  );

  return {
    total_records:        totalRecords,
    labeled_records:      labeledRecords,
    total_feedback:       totalFeedback,
    feedback_by_channel,
    feedback_by_action,
    label_distribution,
    avg_precision:  avgRow.avg_p  ?? null,
    avg_recall:     avgRow.avg_r  ?? null,
    avg_rl_reward:  avgRow.avg_rl ?? null,
  };
}

// ── Paginated record list (lightweight — no diff/prompt) ──────────────────────

export interface TrainingRecordSummary {
  id: number;
  run_id: string;
  created_at: string;
  repository: string;
  branch?: string;
  pr_number?: number;
  actor?: string;
  model_version?: string;
  analysis_type?: string;
  gate_status: string;
  status: string;
  total_issues: number;
  source: string;
  feedback_count: number;
  supervised_label?: string;
  precision_score?: number;
  recall_score?: number;
  rl_reward?: number;
  true_positives?: number;
  false_positives?: number;
  false_negatives?: number;
}

export async function listTrainingRecords(params: {
  repository?: string;
  labeled?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<TrainingRecordSummary[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const sqlParams: (string | number)[] = [];

  if (params.repository) { conditions.push('r.repository = ?');  sqlParams.push(params.repository); }
  if (params.from)       { conditions.push('r.created_at >= ?'); sqlParams.push(params.from); }
  if (params.to)         { conditions.push('r.created_at <= ?'); sqlParams.push(params.to); }
  if (params.labeled)    { conditions.push('l.supervised_label IS NOT NULL'); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit  = params.limit  ?? 50;
  const offset = params.offset ?? 0;
  sqlParams.push(limit, offset);

  const stmt = db.prepare(`
    SELECT
      r.id, r.run_id, r.created_at, r.repository, r.branch, r.pr_number,
      r.actor, r.model_version, r.analysis_type,
      r.gate_status, r.status, r.total_issues, r.source,
      (SELECT COUNT(*) FROM training_feedback f WHERE f.record_id = r.id) AS feedback_count,
      l.supervised_label, l.precision_score, l.recall_score, l.rl_reward,
      l.true_positives, l.false_positives, l.false_negatives
    FROM training_records r
    LEFT JOIN training_labels l ON l.record_id = r.id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `);
  stmt.bind(sqlParams);

  const rows: TrainingRecordSummary[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as TrainingRecordSummary);
  }
  stmt.free();
  return rows;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeParseJSON<T>(raw: any, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
