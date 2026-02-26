/**
 * PR Review Route — POST /api/review/pr
 *
 * The primary entry point for the GitHub Actions workflow.
 * Accepts multiple files from a PR diff, runs dual-layer analysis
 * (deterministic pattern rules + LLM-based review) on each file,
 * and returns a structured response used for:
 *   - PR gate enforcement (pass/fail)
 *   - Automated PR comment generation
 *   - Observability dashboard population
 *
 * Gate logic:
 *   FAIL if any validation rule fires (any severity)
 *   FAIL if any LLM finding is critical severity
 */

import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { runPatternRules, mergeIssues } from '../engine/pattern-rules.js';
import { calculateCost } from '../db/pricing.js';
import { getAIPlatformConfig, callAIPlatform } from './ai-platform.js';
import type {
  ValidationFailure,
  LLMFinding,
  PerFileResult,
  SeverityDistribution,
} from '../db/run-details.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface ReviewFile {
  path: string;
  content: string;
  language: string;
}

interface ReviewMetadata {
  repository: string;
  pr_number?: number;
  branch?: string;
  base_branch?: string;
  commit_sha?: string;
  actor?: string;
  workflow_run_id: string;
  project_id?: string;
}

type AnalysisType = 'complexity' | 'security' | 'review' | 'quality';

interface PRReviewRequest {
  files: ReviewFile[];
  metadata: ReviewMetadata;
  analysis_type?: AnalysisType;
}

interface PRReviewResponse {
  run_id: string;
  status: 'success' | 'failure' | 'partial';
  gate_status: 'pass' | 'fail';
  files_reviewed: number;
  total_issues: number;
  severity_breakdown: SeverityDistribution;
  validation_failures: ValidationFailure[];
  llm_findings: LLMFinding[];
  per_file_results: PerFileResult[];
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  model: string;
  latency_ms: number;
  timestamp: string;
  error?: string;
}

interface LLMAnalysisResult {
  issues: Array<{
    severity: string;
    category: string;
    message: string;
    suggestion: string;
    reasoning?: string;
    lineNumber?: number;
  }>;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

// ── Router factory ─────────────────────────────────────────────────────────

export function createPRReviewRouter(): Router {
  const router = Router();

  const rawApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const apiKey = rawApiKey?.trim();
  let defaultClaude: Anthropic | null = null;

  if (apiKey?.startsWith('sk-ant-')) {
    defaultClaude = new Anthropic({ apiKey });
    console.log('[PR-REVIEW] Anthropic SDK initialized');
  } else {
    console.warn('[PR-REVIEW] ANTHROPIC_API_KEY not configured — LLM analysis will be skipped');
  }

  // ── POST /api/review/pr ──────────────────────────────────────────────────
  router.post('/review/pr', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const body = req.body as PRReviewRequest;

      // ── Validate request ──
      if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
        return res.status(400).json({ error: 'files array is required and must not be empty' });
      }
      if (!body.metadata?.repository) {
        return res.status(400).json({ error: 'metadata.repository is required' });
      }
      if (!body.metadata?.workflow_run_id) {
        return res.status(400).json({ error: 'metadata.workflow_run_id is required' });
      }

      const { files, metadata, analysis_type } = body;
      const analysisType: AnalysisType = analysis_type ?? 'review';
      const runId = `${metadata.workflow_run_id}-${analysisType}-${Date.now()}`;

      console.log(
        `[PR-REVIEW] Run ${runId}: ${files.length} file(s) for ${metadata.repository} ` +
        `PR#${metadata.pr_number ?? 'n/a'} branch=${metadata.branch ?? 'n/a'} ` +
        `analysis_type=${analysisType}`,
      );

      // ── Resolve AI client ──
      const aiProvider = req.headers['x-ai-provider'] as string | undefined;
      const aiModel = req.headers['x-ai-model'] as string | undefined;
      const runtimeKey = (req.headers['x-anthropic-api-key'] as string)?.trim();
      const claude =
        runtimeKey?.startsWith('sk-ant-')
          ? new Anthropic({ apiKey: runtimeKey })
          : defaultClaude;

      // ── Per-file analysis ──
      const allValidationFailures: ValidationFailure[] = [];
      const allLLMFindings: LLMFinding[] = [];
      const perFileResults: PerFileResult[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let resolvedModel = aiModel || 'claude-sonnet-4-20250514';
      let hasError = false;

      for (const file of files) {
        if (!file.path || !file.content || !file.language) continue;

        console.log(`[PR-REVIEW] Analyzing ${file.path} (${file.language}, ${file.content.length} chars)`);

        try {
          // Step 1: Deterministic pattern rules (always runs, no API cost)
          const patternIssues = runPatternRules(file.content, file.language);

          // Step 2: LLM analysis
          let llmIssues: LLMAnalysisResult['issues'] = [];
          let tokenUsage = { inputTokens: 0, outputTokens: 0, model: resolvedModel };

          if (aiProvider === 'ai-platform') {
            const platformConfig = getAIPlatformConfig(req);
            if (platformConfig) {
              const prompt = buildReviewPrompt(file.content, file.language, file.path, analysisType);
              const result = await callAIPlatform(
                platformConfig,
                aiModel || 'gpt-4',
                [{ role: 'user', content: prompt }],
                undefined,
                8192,
              );
              llmIssues = parseLLMResponse(result.text).issues;
              tokenUsage = result.usage;
            }
          } else if (claude) {
            const prompt = buildReviewPrompt(file.content, file.language, file.path, analysisType);
            const response = await claude.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8192,
              messages: [{ role: 'user', content: prompt }],
            });

            const responseText = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map(b => b.text)
              .join('');

            llmIssues = parseLLMResponse(responseText).issues;
            tokenUsage = {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              model: response.model,
            };
          }

          totalInputTokens += tokenUsage.inputTokens;
          totalOutputTokens += tokenUsage.outputTokens;
          if (tokenUsage.model) resolvedModel = tokenUsage.model;

          // Step 3: Separate validation failures from LLM findings
          //  - validation failures = all pattern rule hits
          //  - llm findings = LLM issues that are NOT duplicates of pattern issues
          const mergedIssues = mergeIssues(patternIssues, llmIssues);

          const fileValidationFailures: ValidationFailure[] = patternIssues.map(pi => ({
            severity: pi.severity,
            category: pi.category,
            message: pi.message,
            suggestion: pi.suggestion,
            file: file.path,
            line_number: pi.lineNumber,
          }));

          // LLM findings that were NOT deduplicated by the merge (i.e., unique LLM discoveries)
          const patternMessageSet = new Set(patternIssues.map(p => p.message));
          const fileLLMFindings: LLMFinding[] = llmIssues
            .filter(li => !patternMessageSet.has(li.message))
            .map(li => ({
              severity: li.severity,
              category: li.category,
              message: li.message,
              suggestion: li.suggestion,
              reasoning: li.reasoning,
              file: file.path,
              line_number: li.lineNumber,
            }));

          allValidationFailures.push(...fileValidationFailures);
          allLLMFindings.push(...fileLLMFindings);

          perFileResults.push({
            file: file.path,
            language: file.language,
            validation_count: fileValidationFailures.length,
            llm_count: fileLLMFindings.length,
            issues: mergedIssues.map(i => ({
              severity: i.severity,
              category: i.category,
              message: i.message,
              suggestion: i.suggestion,
              reasoning: i.reasoning,
              line_number: i.lineNumber,
            })),
          });
        } catch (fileErr: any) {
          console.error(`[PR-REVIEW] Failed to analyze ${file.path}:`, fileErr.message);
          hasError = true;
          perFileResults.push({
            file: file.path,
            language: file.language,
            validation_count: 0,
            llm_count: 0,
            issues: [],
            error: fileErr.message,
          });
        }
      }

      // ── Aggregate severity breakdown ──
      const allIssues = [...allValidationFailures, ...allLLMFindings];
      const severityBreakdown: SeverityDistribution = {
        critical: allIssues.filter(i => i.severity === 'critical').length,
        high:     allIssues.filter(i => i.severity === 'high').length,
        medium:   allIssues.filter(i => i.severity === 'medium').length,
        low:      allIssues.filter(i => i.severity === 'low').length,
        info:     allIssues.filter(i => i.severity === 'info').length,
      };

      const totalIssues = allIssues.length;
      const hasCriticalLLM = allLLMFindings.some(f => f.severity === 'critical');

      // Gate logic per spec:
      //   FAIL if any validation rule fires
      //   FAIL if any critical LLM finding
      const gateStatus: 'pass' | 'fail' =
        allValidationFailures.length > 0 || hasCriticalLLM ? 'fail' : 'pass';

      const status: 'success' | 'failure' | 'partial' =
        hasError && totalIssues === 0
          ? 'partial'
          : gateStatus === 'fail'
            ? 'failure'
            : 'success';

      const latencyMs = Date.now() - startTime;
      const costUsd = calculateCost(resolvedModel, totalInputTokens, totalOutputTokens);

      const response: PRReviewResponse = {
        run_id: runId,
        status,
        gate_status: gateStatus,
        files_reviewed: files.length,
        total_issues: totalIssues,
        severity_breakdown: severityBreakdown,
        validation_failures: allValidationFailures,
        llm_findings: allLLMFindings,
        per_file_results: perFileResults,
        token_usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          total_tokens: totalInputTokens + totalOutputTokens,
        },
        cost_usd: costUsd,
        model: resolvedModel,
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      };

      console.log(
        `[PR-REVIEW] Run ${runId} complete: gate=${gateStatus}, issues=${totalIssues} ` +
        `(${severityBreakdown.critical}C/${severityBreakdown.high}H), ` +
        `tokens=${totalInputTokens + totalOutputTokens}, cost=$${costUsd.toFixed(6)}, ` +
        `latency=${latencyMs}ms`,
      );

      return res.json(response);
    } catch (error: any) {
      console.error('[PR-REVIEW] Request failed:', error.message);

      if (error.status === 401) {
        return res.status(401).json({ error: 'AI API authentication failed. Check ANTHROPIC_API_KEY.' });
      }
      if (error.status === 429) {
        return res.status(429).json({ error: 'AI API rate limit exceeded. Retry after backoff.' });
      }
      if (error.status >= 500) {
        return res.status(503).json({ error: 'AI API temporarily unavailable.' });
      }

      return res.status(500).json({ error: 'PR review failed', details: error.message });
    }
  });

  return router;
}

// ── Prompt builders ─────────────────────────────────────────────────────────

function buildReviewPrompt(
  code: string,
  language: string,
  filePath: string,
  analysisType: AnalysisType = 'review',
): string {
  const languageContext: Record<string, string> = {
    pyspark:    'PySpark engineer specializing in big data, Spark optimization, and distributed processing',
    python:     'Python engineer specializing in clean code, performance, security, and best practices',
    typescript: 'TypeScript engineer specializing in type safety, async patterns, and Node.js best practices',
    javascript: 'JavaScript engineer specializing in modern ES6+, async patterns, and web best practices',
    scala:      'Scala engineer specializing in functional programming, type safety, and Spark optimization',
    sql:        'SQL engineer specializing in query optimization, indexing, and database performance',
    terraform:  'Terraform engineer specializing in Infrastructure as Code, cloud security, and best practices',
  };

  const context = languageContext[language.toLowerCase()] ??
    'software engineer specializing in code quality, security, and best practices';

  const focusByType: Record<AnalysisType, string> = {
    complexity: `Focus EXCLUSIVELY on code complexity issues:
1. Functions or methods that are too long or do too many things (single responsibility violations)
2. Deeply nested conditionals or loops (high cyclomatic complexity)
3. Hard-to-follow control flow, spaghetti logic, or excessive early returns
4. Large classes or modules that should be decomposed
5. Duplicated logic that increases maintenance burden
6. Overly complex expressions or data transformations that hurt readability`,

    security: `Focus EXCLUSIVELY on security vulnerabilities:
1. Injection flaws (SQL, command, LDAP, XPath injection)
2. Authentication and authorization bypass
3. Insecure data handling (plaintext secrets, unencrypted sensitive data)
4. Insecure deserialization or unsafe eval/exec usage
5. Missing input validation or output encoding
6. Exposed credentials, tokens, or API keys in code
7. Insecure cryptography or weak hashing algorithms
8. Path traversal or arbitrary file access vulnerabilities`,

    review: `Focus on semantic issues that require code understanding:
1. Logic errors and semantic bugs
2. Incorrect algorithm implementations or off-by-one errors
3. Performance problems (N+1 queries, blocking I/O in hot paths, memory leaks)
4. Race conditions, concurrency bugs, or incorrect async usage
5. Missing or incorrect error handling
6. Data flow issues (null dereferences, type mismatches)`,

    quality: `Focus EXCLUSIVELY on code quality and maintainability:
1. Violations of SOLID principles
2. Missing or inadequate error handling and exception management
3. Poor naming conventions or misleading variable/function names
4. Lack of input validation at system boundaries
5. Hard-coded magic numbers or strings that should be constants
6. Missing null/undefined checks that could cause runtime failures
7. Overly coupled code with poor separation of concerns
8. Dead code, unreachable branches, or unused variables`,
  };

  return `You are an expert ${context}.

You are performing a **${analysisType.toUpperCase()} ANALYSIS** of \`${filePath}\` as part of an automated pull request pipeline.

${focusByType[analysisType]}

Pattern-based checks (hardcoded secrets detected by regex, etc.) are handled by a separate rule engine — do not repeat those.

CODE TO ANALYZE (${filePath}):
\`\`\`${language}
${code}
\`\`\`

Return ONLY valid JSON in this exact format:
{
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "Security" | "Performance" | "Logic" | "Architecture" | "Complexity" | "Quality" | "Data Flow" | "Best Practice",
      "message": "Concise description of the issue",
      "lineNumber": 42,
      "suggestion": "Specific actionable fix",
      "reasoning": "Why this matters and what the impact is"
    }
  ]
}

If there are no issues in scope for this analysis type, return: {"issues": []}
Return ONLY the JSON object. No markdown, no explanation.`;
}

// ── LLM response parser ────────────────────────────────────────────────────

function parseLLMResponse(text: string): { issues: LLMAnalysisResult['issues'] } {
  let jsonText = text.trim();

  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) jsonText = codeBlockMatch[1].trim();

  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    jsonText = jsonText.substring(start, end + 1);
  }

  const tryParse = (s: string) => {
    try {
      const parsed = JSON.parse(s);
      return { issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
    } catch {
      return null;
    }
  };

  return (
    tryParse(jsonText) ??
    tryParse(jsonText.replace(/,\s*([\]}])/g, '$1')) ?? { issues: [] }
  );
}
