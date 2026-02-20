/**
 * Batch Code Review API
 * Supports multi-file code review for CI/CD pipelines
 * Outputs in JSON, Markdown, or SARIF formats
 */

import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getAIPlatformConfig, callAIPlatform } from './ai-platform.js';
import { runPatternRules, mergeIssues } from '../engine/pattern-rules.js';

// ============ Types ============

export interface FileToReview {
  path: string;
  content: string;
  language?: string;
  diff?: string;
}

export interface FileReviewResult {
  path: string;
  language: string;
  issues: ReviewIssue[];
  strengths: string[];
  recommendations: string[];
  score: number;
  linesAnalyzed: number;
  refactoredCode?: string;
}

export interface ReviewIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  lineNumber?: number;
  endLineNumber?: number;
  column?: number;
  suggestion?: string;
  reasoning?: string;
  ruleId?: string;
  source: 'pattern' | 'ai' | 'both';
}

export interface BatchReviewResult {
  summary: BatchSummary;
  files: FileReviewResult[];
  timestamp: string;
  duration: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

export interface BatchSummary {
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
  recommendation: string;
}

export interface SARIFReport {
  $schema: string;
  version: string;
  runs: SARIFRun[];
}

interface SARIFRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SARIFRule[];
    };
  };
  results: SARIFResult[];
}

interface SARIFRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration: { level: 'error' | 'warning' | 'note' | 'none' };
  helpUri?: string;
}

interface SARIFResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: {
        startLine: number;
        endLine?: number;
        startColumn?: number;
      };
    };
  }>;
}

// ============ Helpers ============

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'py': 'python',
    'scala': 'scala',
    'sc': 'scala',
    'sql': 'sql',
    'tf': 'terraform',
    'hcl': 'terraform',
    'java': 'java',
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'sh': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'json': 'json',
  };
  return languageMap[ext] || 'text';
}

function isPySparkFile(content: string, language: string): boolean {
  if (language !== 'python') return false;
  const pysparkIndicators = [
    'from pyspark',
    'import pyspark',
    'SparkSession',
    'SparkContext',
    '.read.',
    '.write.',
    'DataFrame',
    'spark.sql',
    '.createDataFrame',
  ];
  return pysparkIndicators.some(indicator => content.includes(indicator));
}

function getClaudeClient(req: Request, defaultClient: Anthropic | null): Anthropic | null {
  const runtimeKey = (req.headers['x-anthropic-api-key'] as string)?.trim();
  if (runtimeKey && runtimeKey.startsWith('sk-ant-')) {
    return new Anthropic({ apiKey: runtimeKey });
  }
  return defaultClient;
}

function severityToSARIFLevel(severity: string): 'error' | 'warning' | 'note' | 'none' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'info':
      return 'note';
    default:
      return 'none';
  }
}

function generateRuleId(category: string, message: string): string {
  const categoryCode = category.substring(0, 3).toUpperCase();
  const hash = message.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `${categoryCode}-${Math.abs(hash).toString(16).substring(0, 6).toUpperCase()}`;
}

// ============ Multi-File AI Prompt ============

function buildBatchPrompt(files: FileToReview[]): string {
  const fileContexts = files.map((file, index) => {
    const lang = file.language || detectLanguage(file.path);
    return `
=== FILE ${index + 1}: ${file.path} (${lang}) ===
\`\`\`${lang}
${file.content}
\`\`\`
${file.diff ? `\nCHANGED LINES (from git diff):\n${file.diff}` : ''}
`;
  }).join('\n\n');

  return `You are an expert code reviewer analyzing multiple files from a code repository.
Analyze each file and identify issues, strengths, and recommendations.

FILES TO REVIEW:
${fileContexts}

For each file, identify:
1. **Performance Issues**: Inefficient operations, bottlenecks
2. **Security Issues**: Vulnerabilities, misconfigurations, exposed secrets
3. **Code Quality Issues**: Anti-patterns, maintainability problems
4. **Best Practice Violations**: Deviations from industry standards
5. **Logic Issues**: Bugs, incorrect implementations

Return your analysis as a JSON array with one object per file:
{
  "files": [
    {
      "path": "path/to/file.py",
      "issues": [
        {
          "severity": "critical" | "high" | "medium" | "low" | "info",
          "category": "Performance" | "Security" | "Code Quality" | "Best Practice" | "Logic",
          "message": "Brief description",
          "lineNumber": 42,
          "suggestion": "How to fix",
          "reasoning": "Why this matters"
        }
      ],
      "strengths": ["Good practices observed"],
      "recommendations": ["Improvement suggestions"],
      "score": 85
    }
  ],
  "crossFileIssues": [
    {
      "severity": "medium",
      "category": "Architecture",
      "message": "Issue spanning multiple files",
      "affectedFiles": ["file1.py", "file2.py"],
      "suggestion": "How to address"
    }
  ],
  "overallRecommendations": ["Repository-wide suggestions"]
}

IMPORTANT:
- Focus on actionable, specific feedback
- Include line numbers when possible
- Consider cross-file dependencies and patterns
- Return ONLY valid JSON, no markdown blocks`;
}

// ============ Parse AI Response ============

interface ParsedBatchResponse {
  files: Array<{
    path: string;
    issues: ReviewIssue[];
    strengths: string[];
    recommendations: string[];
    score: number;
  }>;
  crossFileIssues: ReviewIssue[];
  overallRecommendations: string[];
}

function parseAIBatchResponse(responseText: string): ParsedBatchResponse {
  let jsonText = responseText.trim();

  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  const startIdx = jsonText.indexOf('{');
  const endIdx = jsonText.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) {
    jsonText = jsonText.substring(startIdx, endIdx + 1);
  }

  try {
    const repaired = jsonText
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/[\x00-\x1f]/g, m =>
        m === '\n' ? '\\n' : m === '\r' ? '\\r' : m === '\t' ? '\\t' : ''
      );

    const parsed = JSON.parse(repaired);
    return {
      files: (parsed.files || []).map((f: any) => ({
        path: f.path,
        issues: (f.issues || []).map((i: any) => ({
          ...i,
          source: 'ai' as const,
          ruleId: generateRuleId(i.category || 'GEN', i.message),
        })),
        strengths: f.strengths || [],
        recommendations: f.recommendations || [],
        score: f.score || 70,
      })),
      crossFileIssues: (parsed.crossFileIssues || []).map((i: any) => ({
        ...i,
        source: 'ai' as const,
        ruleId: generateRuleId(i.category || 'ARCH', i.message),
      })),
      overallRecommendations: parsed.overallRecommendations || [],
    };
  } catch (err) {
    console.error('[BATCH-REVIEW] Failed to parse AI response:', err);
    return {
      files: [],
      crossFileIssues: [],
      overallRecommendations: ['AI analysis returned non-standard format'],
    };
  }
}

// ============ Generate Reports ============

function generateMarkdownReport(result: BatchReviewResult): string {
  const lines: string[] = [];

  lines.push('# Code Review Report');
  lines.push('');
  lines.push(`**Generated:** ${result.timestamp}`);
  lines.push(`**Duration:** ${result.duration}ms`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Files Analyzed | ${result.summary.totalFiles} |`);
  lines.push(`| Files with Issues | ${result.summary.filesWithIssues} |`);
  lines.push(`| Total Issues | ${result.summary.totalIssues} |`);
  lines.push(`| Critical | ${result.summary.criticalCount} |`);
  lines.push(`| High | ${result.summary.highCount} |`);
  lines.push(`| Medium | ${result.summary.mediumCount} |`);
  lines.push(`| Low | ${result.summary.lowCount} |`);
  lines.push(`| Average Score | ${result.summary.averageScore}/100 |`);
  lines.push(`| Status | ${result.summary.passThreshold ? '✅ PASS' : '❌ FAIL'} |`);
  lines.push('');
  lines.push('## File Results');
  lines.push('');

  for (const file of result.files) {
    lines.push(`### ${file.path}`);
    lines.push('');
    lines.push(`**Language:** ${file.language} | **Score:** ${file.score}/100 | **Issues:** ${file.issues.length}`);
    lines.push('');

    if (file.issues.length > 0) {
      lines.push('#### Issues');
      lines.push('');
      for (const issue of file.issues) {
        const icon = issue.severity === 'critical' ? '🔴' :
                     issue.severity === 'high' ? '🟠' :
                     issue.severity === 'medium' ? '🟡' :
                     issue.severity === 'low' ? '🔵' : 'ℹ️';
        lines.push(`- ${icon} **${issue.severity.toUpperCase()}** (${issue.category}): ${issue.message}`);
        if (issue.lineNumber) lines.push(`  - Line: ${issue.lineNumber}`);
        if (issue.suggestion) lines.push(`  - Fix: ${issue.suggestion}`);
      }
      lines.push('');
    }

    if (file.strengths.length > 0) {
      lines.push('#### Strengths');
      lines.push('');
      file.strengths.forEach(s => lines.push(`- ✅ ${s}`));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('*Generated by AI Code Review Assistant*');

  return lines.join('\n');
}

function generateSARIFReport(result: BatchReviewResult): SARIFReport {
  const rules: SARIFRule[] = [];
  const ruleMap = new Map<string, SARIFRule>();
  const results: SARIFResult[] = [];

  for (const file of result.files) {
    for (const issue of file.issues) {
      const ruleId = issue.ruleId || generateRuleId(issue.category, issue.message);

      if (!ruleMap.has(ruleId)) {
        const rule: SARIFRule = {
          id: ruleId,
          name: issue.category,
          shortDescription: { text: issue.message.substring(0, 100) },
          fullDescription: issue.reasoning ? { text: issue.reasoning } : undefined,
          defaultConfiguration: { level: severityToSARIFLevel(issue.severity) },
        };
        ruleMap.set(ruleId, rule);
        rules.push(rule);
      }

      results.push({
        ruleId,
        level: severityToSARIFLevel(issue.severity),
        message: { text: `${issue.message}${issue.suggestion ? `\n\nSuggestion: ${issue.suggestion}` : ''}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: file.path },
            region: issue.lineNumber ? {
              startLine: issue.lineNumber,
              endLine: issue.endLineNumber,
              startColumn: issue.column,
            } : undefined,
          },
        }],
      });
    }
  }

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'AI Code Review Assistant',
          version: '1.0.0',
          informationUri: 'https://github.com/prismflow/code-review',
          rules,
        },
      },
      results,
    }],
  };
}

// ============ Router ============

export function createBatchReviewRouter(): Router {
  const router = Router();

  const rawApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const apiKey = rawApiKey?.trim();
  let defaultClaude: Anthropic | null = null;

  if (apiKey && apiKey.startsWith('sk-ant-')) {
    defaultClaude = new Anthropic({ apiKey });
    console.log('[BATCH-REVIEW] Anthropic SDK initialized');
  }

  router.post('/review/batch', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { files, options = {} } = req.body as {
        files: FileToReview[];
        options?: {
          threshold?: number;
          format?: 'json' | 'markdown' | 'sarif';
          failOnCritical?: boolean;
          failOnHigh?: boolean;
          maxIssuesPerFile?: number;
          skipPatterns?: string[];
        };
      };

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'files array is required and must not be empty' });
      }

      const {
        threshold = 70,
        format = 'json',
        failOnCritical = true,
        failOnHigh = false,
        maxIssuesPerFile = 50,
        skipPatterns = [],
      } = options;

      console.log(`[BATCH-REVIEW] Starting review of ${files.length} files`);

      const filesToReview = files.filter(f => {
        return !skipPatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(f.path);
        });
      });

      console.log(`[BATCH-REVIEW] ${filesToReview.length} files after filtering`);

      const fileResults: FileReviewResult[] = [];

      for (const file of filesToReview) {
        const language = file.language || detectLanguage(file.path);
        const effectiveLanguage = isPySparkFile(file.content, language) ? 'pyspark' : language;

        const patternIssues = runPatternRules(file.content, effectiveLanguage);
        const issues: ReviewIssue[] = patternIssues.map(i => ({
          ...i,
          severity: i.severity as ReviewIssue['severity'],
          source: 'pattern' as const,
          ruleId: generateRuleId(i.category, i.message),
        }));

        fileResults.push({
          path: file.path,
          language: effectiveLanguage,
          issues,
          strengths: [],
          recommendations: [],
          score: 100,
          linesAnalyzed: file.content.split('\n').length,
        });
      }

      let tokenUsage: BatchReviewResult['tokenUsage'];
      const aiProvider = req.headers['x-ai-provider'] as string;
      const aiModel = req.headers['x-ai-model'] as string;

      if (aiProvider === 'ai-platform') {
        const platformConfig = getAIPlatformConfig(req);
        if (platformConfig) {
          const prompt = buildBatchPrompt(filesToReview);
          const result = await callAIPlatform(platformConfig, aiModel || 'gpt-4', [{ role: 'user', content: prompt }], undefined, 16384);
          const aiResults = parseAIBatchResponse(result.text);
          mergeAIResults(fileResults, aiResults);
          tokenUsage = result.usage;
        }
      } else {
        const claude = getClaudeClient(req, defaultClaude);
        if (claude) {
          const prompt = buildBatchPrompt(filesToReview);
          const response = await claude.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16384,
            messages: [{ role: 'user', content: prompt }],
          });

          const responseText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map(b => b.text)
            .join('');

          const aiResults = parseAIBatchResponse(responseText);
          mergeAIResults(fileResults, aiResults);
          tokenUsage = {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            model: response.model,
          };
        }
      }

      for (const file of fileResults) {
        if (file.issues.length > maxIssuesPerFile) {
          file.issues = file.issues.slice(0, maxIssuesPerFile);
        }

        let score = 100;
        for (const issue of file.issues) {
          switch (issue.severity) {
            case 'critical': score -= 25; break;
            case 'high': score -= 15; break;
            case 'medium': score -= 10; break;
            case 'low': score -= 5; break;
            case 'info': score -= 2; break;
          }
        }
        file.score = Math.max(0, Math.min(100, score));
      }

      const allIssues = fileResults.flatMap(f => f.issues);
      const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
      const highCount = allIssues.filter(i => i.severity === 'high').length;
      const mediumCount = allIssues.filter(i => i.severity === 'medium').length;
      const lowCount = allIssues.filter(i => i.severity === 'low').length;
      const infoCount = allIssues.filter(i => i.severity === 'info').length;

      const averageScore = fileResults.length > 0
        ? Math.round(fileResults.reduce((sum, f) => sum + f.score, 0) / fileResults.length)
        : 100;

      const passThreshold = averageScore >= threshold &&
        (!failOnCritical || criticalCount === 0) &&
        (!failOnHigh || highCount === 0);

      const summary: BatchSummary = {
        totalFiles: fileResults.length,
        filesWithIssues: fileResults.filter(f => f.issues.length > 0).length,
        totalIssues: allIssues.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        infoCount,
        averageScore,
        passThreshold,
        recommendation: passThreshold
          ? 'Code review passed. Minor improvements recommended.'
          : criticalCount > 0
            ? 'BLOCK: Critical issues found that must be addressed before merge.'
            : highCount > 0
              ? 'WARN: High severity issues found. Review recommended before merge.'
              : `Average score (${averageScore}) is below threshold (${threshold}).`,
      };

      const result: BatchReviewResult = {
        summary,
        files: fileResults,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        tokenUsage,
      };

      console.log(`[BATCH-REVIEW] Completed: ${result.summary.totalFiles} files, ${result.summary.totalIssues} issues, ${result.duration}ms`);

      switch (format) {
        case 'markdown':
          res.setHeader('Content-Type', 'text/markdown');
          res.send(generateMarkdownReport(result));
          break;
        case 'sarif':
          res.setHeader('Content-Type', 'application/sarif+json');
          res.json(generateSARIFReport(result));
          break;
        default:
          res.json(result);
      }
    } catch (error: any) {
      console.error('[BATCH-REVIEW] Review failed:', error.message);
      res.status(500).json({ error: 'Batch review failed', details: error.message });
    }
  });

  router.post('/review/pr', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { files, options = {} } = req.body as {
        prNumber?: number;
        baseBranch?: string;
        headBranch?: string;
        files: Array<FileToReview & { status?: 'added' | 'modified' | 'deleted' }>;
        options?: { threshold?: number; format?: 'json' | 'markdown' | 'sarif'; onlyChangedLines?: boolean };
      };

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'files array is required' });
      }

      const reviewableFiles = files.filter(f => f.status !== 'deleted');

      const batchReq = {
        ...req,
        body: {
          files: reviewableFiles,
          options: { ...options, threshold: options.threshold || 75, failOnCritical: true, failOnHigh: true },
        },
      };

      return (router as any).handle(batchReq, res, () => {});
    } catch (error: any) {
      console.error('[BATCH-REVIEW] PR review failed:', error.message);
      res.status(500).json({ error: 'PR review failed', details: error.message });
    }
  });

  router.get('/review/health', (_req: Request, res: Response) => {
    res.json({
      status: defaultClaude ? 'healthy' : 'degraded',
      service: 'batch-code-review',
      aiConfigured: !!defaultClaude,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

// ============ Merge AI Results ============

function mergeAIResults(fileResults: FileReviewResult[], aiResults: ParsedBatchResponse): void {
  for (const aiFile of aiResults.files) {
    const fileResult = fileResults.find(f => f.path === aiFile.path);
    if (!fileResult) continue;

    for (const aiIssue of aiFile.issues) {
      const existingIssue = fileResult.issues.find(i =>
        i.lineNumber === aiIssue.lineNumber &&
        i.category.toLowerCase() === aiIssue.category.toLowerCase()
      );

      if (existingIssue) {
        existingIssue.source = 'both';
        if (aiIssue.reasoning) existingIssue.reasoning = aiIssue.reasoning;
      } else {
        fileResult.issues.push(aiIssue);
      }
    }

    fileResult.strengths.push(...aiFile.strengths);
    fileResult.recommendations.push(...aiFile.recommendations);
  }
}
