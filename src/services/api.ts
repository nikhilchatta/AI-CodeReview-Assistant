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
