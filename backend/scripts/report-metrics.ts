/**
 * Taskflow Metric Emitter
 *
 * Standalone script invoked as a post-review step in GitHub Actions.
 * Reads the ci-review JSON output and POSTs observability metrics
 * to the AI Code Review server.
 *
 * Usage (in GitHub Actions):
 *   npx tsx scripts/report-metrics.ts --result-file review-output.json
 *
 * Or pipe directly from ci-review:
 *   npx tsx scripts/ci-review.ts --format json "src/**\/*.py" > review-output.json
 *   npx tsx scripts/report-metrics.ts --result-file review-output.json
 *
 * Environment variables (auto-populated by GitHub Actions):
 *   GITHUB_REPOSITORY       – owner/repo
 *   GITHUB_RUN_ID           – workflow run ID
 *   GITHUB_REF_NAME         – branch name
 *   GITHUB_ACTOR            – who triggered the run
 *   GITHUB_EVENT_NAME       – push, pull_request, etc.
 *   METRICS_API_URL         – AI Code Review server URL (default: http://localhost:5001/api)
 *   METRICS_PROJECT_ID      – logical project grouping (default: repository name)
 *   ANTHROPIC_API_KEY       – used only to derive token hash for identification
 *   PR_NUMBER               – pull request number (optional)
 */

import fs from 'fs';

interface ReviewOutput {
  summary: {
    totalFiles: number;
    filesWithIssues: number;
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    averageScore: number;
    passThreshold: boolean;
  };
  files: Array<{ path: string; issues: any[]; score: number }>;
  timestamp?: string;
  duration?: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

interface MetricPayload {
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
  cost_usd?: number;
  pr_number?: number;
  branch?: string;
  triggered_by?: string;
}

function parseArgs(): { resultFile: string; metricsUrl: string; errorMessage?: string } {
  const args = process.argv.slice(2);
  let resultFile = '';
  let metricsUrl = process.env.METRICS_API_URL || process.env.CODE_REVIEW_API_URL || 'http://localhost:5001/api';
  let errorMessage: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--result-file':
        resultFile = args[++i];
        break;
      case '--metrics-url':
        metricsUrl = args[++i];
        break;
      case '--error':
        errorMessage = args[++i];
        break;
      case '--help':
        console.log(`
Usage: npx tsx scripts/report-metrics.ts [options]

Options:
  --result-file <path>    Path to ci-review JSON output file
  --metrics-url <url>     Metrics API URL (default: $METRICS_API_URL or http://localhost:5001/api)
  --error <message>       Report a failed run with this error message
  --help                  Show this help
`);
        process.exit(0);
    }
  }

  return { resultFile, metricsUrl, errorMessage };
}

function tokenHash(key?: string): string | undefined {
  if (!key) return undefined;
  return key.slice(-8);
}

async function main(): Promise<void> {
  const { resultFile, metricsUrl, errorMessage } = parseArgs();

  const repository = process.env.GITHUB_REPOSITORY || 'unknown/unknown';
  const projectId = process.env.METRICS_PROJECT_ID || repository;
  const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
  const branch = process.env.GITHUB_REF_NAME || 'unknown';
  const triggeredBy = process.env.GITHUB_ACTOR || 'unknown';
  const prNumber = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER, 10) : undefined;
  const apiKeyHash = tokenHash(process.env.ANTHROPIC_API_KEY);

  let payload: MetricPayload;

  // If --error flag is set, report a failure without needing a result file
  if (errorMessage) {
    payload = {
      repository,
      project_id: projectId,
      workflow_run_id: runId,
      timestamp: new Date().toISOString(),
      api_token_hash: apiKeyHash,
      request_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      latency_ms: 0,
      status: 'failure',
      error_message: errorMessage,
      files_reviewed: 0,
      issues_found: 0,
      critical_count: 0,
      high_count: 0,
      pr_number: prNumber,
      branch,
      triggered_by: triggeredBy,
    };
  } else {
    // Read the review result file
    if (!resultFile) {
      console.error('Error: --result-file is required (or use --error for failure reporting)');
      process.exit(1);
    }

    if (!fs.existsSync(resultFile)) {
      console.error(`Error: Result file not found: ${resultFile}`);
      process.exit(1);
    }

    let review: ReviewOutput;
    try {
      review = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
    } catch (err: any) {
      console.error(`Error: Failed to parse result file: ${err.message}`);
      process.exit(1);
    }

    const isSuccess = review.summary.passThreshold;

    payload = {
      repository,
      project_id: projectId,
      workflow_run_id: runId,
      timestamp: review.timestamp || new Date().toISOString(),
      api_token_hash: apiKeyHash,
      request_count: review.files.length > 0 ? 1 : 0, // 1 batch request per run
      input_tokens: review.tokenUsage?.inputTokens ?? 0,
      output_tokens: review.tokenUsage?.outputTokens ?? 0,
      total_tokens: (review.tokenUsage?.inputTokens ?? 0) + (review.tokenUsage?.outputTokens ?? 0),
      latency_ms: review.duration ?? 0,
      status: isSuccess ? 'success' : 'failure',
      files_reviewed: review.summary.totalFiles,
      issues_found: review.summary.totalIssues,
      critical_count: review.summary.criticalCount,
      high_count: review.summary.highCount,
      model: review.tokenUsage?.model,
      pr_number: prNumber,
      branch,
      triggered_by: triggeredBy,
    };
  }

  // POST to the ingestion endpoint
  const url = `${metricsUrl.replace(/\/$/, '')}/metrics/ingest`;
  console.log(`[METRICS-EMITTER] Posting metrics to ${url}`);
  console.log(`[METRICS-EMITTER] Repository: ${payload.repository}`);
  console.log(`[METRICS-EMITTER] Run ID: ${payload.workflow_run_id}`);
  console.log(`[METRICS-EMITTER] Status: ${payload.status}`);
  console.log(`[METRICS-EMITTER] Tokens: ${payload.total_tokens} (in: ${payload.input_tokens}, out: ${payload.output_tokens})`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[METRICS-EMITTER] Server returned ${response.status}: ${errorBody}`);
      process.exit(1);
    }

    const result = await response.json() as any;
    console.log(`[METRICS-EMITTER] Metric recorded successfully (id: ${result.id})`);
  } catch (err: any) {
    console.error(`[METRICS-EMITTER] Failed to post metrics: ${err.message}`);
    // Non-blocking: don't fail the CI pipeline because metrics couldn't be recorded
    process.exit(0);
  }
}

main();
