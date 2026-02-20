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

export async function fetchMetricsSummary(params: Pick<MetricsQueryParams, 'repository' | 'project_id' | 'from' | 'to'> = {}) {
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
