const API_BASE = '/api';

export async function fetchAnalyzeCode(code: string, language: string, prompt?: string) {
  const response = await fetch(`${API_BASE}/analyze-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language, prompt }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorData = await response.json();
      errorDetail = errorData.error || errorData.message || '';
    } catch {
      // Response wasn't JSON
    }

    if (response.status === 404) {
      throw new Error('AI API endpoint not found. Is the backend running?');
    } else if (response.status === 401 || response.status === 403) {
      throw new Error('AI API authentication failed. Check your API key.');
    } else if (response.status >= 500) {
      throw new Error(`AI API server error (${response.status}).`);
    } else {
      throw new Error(`API error: ${response.status}${errorDetail ? ` - ${errorDetail}` : ''}`);
    }
  }

  return response.json();
}

export async function fetchHealthCheck() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}

// ── Observability Metrics API ──

export interface MetricsQueryParams {
  repository?: string;
  project_id?: string;
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export async function fetchMetrics(params: MetricsQueryParams = {}) {
  const qs = buildQueryString(params as Record<string, string | number | undefined>);
  const response = await fetch(`${API_BASE}/metrics${qs}`);
  if (!response.ok) throw new Error(`Failed to fetch metrics: ${response.status}`);
  return response.json();
}

export async function fetchRunDetail(runId: string) {
  const response = await fetch(`${API_BASE}/metrics/runs/${encodeURIComponent(runId)}`);
  if (!response.ok) throw new Error(`Failed to fetch run detail: ${response.status}`);
  return response.json();
}

export async function fetchRunDetails(params: { workflow_run_id?: string; source?: string; repository?: string; status?: string; from?: string; to?: string; limit?: number; offset?: number } = {}) {
  const qs = buildQueryString(params as Record<string, string | number | undefined>);
  const response = await fetch(`${API_BASE}/metrics/runs${qs}`);
  if (!response.ok) throw new Error(`Failed to fetch run details: ${response.status}`);
  return response.json();
}

export async function fetchMetricsSummary(params: Pick<MetricsQueryParams, 'repository' | 'project_id' | 'source' | 'from' | 'to'> = {}) {
  const qs = buildQueryString(params as Record<string, string | number | undefined>);
  const response = await fetch(`${API_BASE}/metrics/summary${qs}`);
  if (!response.ok) throw new Error(`Failed to fetch metrics summary: ${response.status}`);
  return response.json();
}

export async function fetchMetricsProjects() {
  const response = await fetch(`${API_BASE}/metrics/projects`);
  if (!response.ok) throw new Error(`Failed to fetch projects: ${response.status}`);
  return response.json();
}

// ── Training Data API ──

export interface FeedbackPayload {
  run_id: string;
  action: 'accept' | 'reject' | 'modify';
  finding_index?: number;
  finding_type?: 'validation' | 'llm' | 'gate';
  reason?: string;
  corrected_findings?: object[];
  reviewer_id?: string;
  feedback_channel?: 'dashboard' | 'gh' | 'pr';
}

export async function submitFeedback(payload: FeedbackPayload) {
  const response = await fetch(`${API_BASE}/training/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || `Feedback submit failed: ${response.status}`);
  }
  return response.json();
}

// ── Training Stats + Records API ──

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

export async function fetchTrainingStats(): Promise<TrainingStats> {
  const response = await fetch(`${API_BASE}/training/stats`);
  if (!response.ok) throw new Error(`Failed to fetch training stats: ${response.status}`);
  return response.json();
}

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

export async function fetchTrainingRecords(params: {
  repository?: string;
  labeled?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ count: number; data: TrainingRecordSummary[] }> {
  const qs = buildQueryString({
    ...params,
    labeled: params.labeled ? 'true' : undefined,
  } as Record<string, string | number | undefined>);
  const response = await fetch(`${API_BASE}/training/records${qs}`);
  if (!response.ok) throw new Error(`Failed to fetch training records: ${response.status}`);
  return response.json();
}

export interface TrainingExportParams {
  format?: 'jsonl' | 'json';
  labeled?: boolean;
  model_version?: string;
  repository?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function fetchTrainingExport(params: TrainingExportParams = {}) {
  const qs = buildQueryString({
    ...params,
    labeled: params.labeled ? 'true' : undefined,
  } as Record<string, string | number | undefined>);
  const response = await fetch(`${API_BASE}/training/export${qs}`);
  if (!response.ok) throw new Error(`Training export failed: ${response.status}`);
  if (params.format === 'jsonl') return response.text();
  return response.json();
}
