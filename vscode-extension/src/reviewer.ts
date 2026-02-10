export interface ReviewIssue {
  severity: string;
  category: string;
  message: string;
  lineNumber?: number;
  suggestion: string;
  reasoning: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  strengths: string[];
  recommendations: string[];
  refactoredCode?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; model: string };
}

export async function reviewCode(
  code: string,
  language: string,
  serverUrl: string,
  apiKey?: string,
): Promise<ReviewResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['x-anthropic-api-key'] = apiKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const res = await fetch(`${serverUrl}/api/analyze-code`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, language }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).error || `Server returned HTTP ${res.status}`);
    }

    return (await res.json()) as ReviewResult;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Review request timed out (180s). Is the Code Review server running?');
    }
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to Code Review server at ${serverUrl}. Is it running?`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
