//#!/usr/bin/env npx ts-node

//**
 //* CI/CD Code Review CLI
 //* Usage: npx ts-node scripts/ci-review.ts [options] <files...>
 //*
 //* Examples:
 //*   # Review specific files
 //*   npx ts-node scripts/ci-review.ts src/main.py src/utils.py
 //*
 //*   # Review changed files in a PR
 //*   git diff --name-only origin/main | xargs npx ts-node scripts/ci-review.ts
 //*
 //*   # Output SARIF for GitHub Actions
 //*   npx ts-node scripts/ci-review.ts --format sarif --output report.sarif src/**/*.py
 //*
 //*   # Fail if critical issues found
 //*   npx ts-node scripts/ci-review.ts --fail-on-critical src/**/*.py
 //*/

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface CLIOptions {
  files: string[];
  format: 'json' | 'markdown' | 'sarif' | 'summary';
  output?: string;
  threshold: number;
  failOnCritical: boolean;
  failOnHigh: boolean;
  apiUrl: string;
  apiKey?: string;
  verbose: boolean;
  dryRun: boolean;
  includeDiff: boolean;
  skipPatterns: string[];
}

interface ReviewResult {
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
    recommendation: string;
  };
  files: Array<{
    path: string;
    language: string;
    issues: Array<{
      severity: string;
      category: string;
      message: string;
      lineNumber?: number;
      suggestion?: string;
    }>;
    score: number;
  }>;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    files: [],
    format: 'summary',
    threshold: 70,
    failOnCritical: false,
    failOnHigh: false,
    apiUrl: process.env.CODE_REVIEW_API_URL || 'http://localhost:5001/api',
    apiKey: process.env.ANTHROPIC_API_KEY,
    verbose: false,
    dryRun: false,
    includeDiff: false,
    skipPatterns: [
      'node_modules/**',
      '**/*.min.js',
      '**/dist/**',
      '**/build/**',
      '**/*.lock',
      '**/package-lock.json',
    ],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--format':
      case '-f':
        options.format = args[++i] as CLIOptions['format'];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--threshold':
      case '-t':
        options.threshold = parseInt(args[++i], 10);
        break;
      case '--fail-on-critical':
        options.failOnCritical = true;
        break;
      case '--fail-on-high':
        options.failOnHigh = true;
        break;
      case '--api-url':
        options.apiUrl = args[++i];
        break;
      case '--api-key':
        options.apiKey = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--include-diff':
        options.includeDiff = true;
        break;
      case '--skip':
        options.skipPatterns.push(args[++i]);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        if (!arg.startsWith('-')) {
          options.files.push(arg);
        }
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
CI/CD Code Review CLI

Usage: npx ts-node scripts/ci-review.ts [options] <files...>

Options:
  -f, --format <type>      Output format: json, markdown, sarif, summary (default: summary)
  -o, --output <file>      Write output to file instead of stdout
  -t, --threshold <num>    Minimum score to pass (default: 70)
  --fail-on-critical       Exit with code 1 if critical issues found
  --fail-on-high           Exit with code 1 if high severity issues found
  --api-url <url>          API server URL (default: http://localhost:5001/api)
  --api-key <key>          Anthropic API key (or set ANTHROPIC_API_KEY env var)
  --include-diff           Include git diff context for changed files
  --skip <pattern>         Skip files matching pattern (can be used multiple times)
  -v, --verbose            Show detailed progress
  --dry-run                List files without reviewing
  -h, --help               Show this help message

Environment Variables:
  CODE_REVIEW_API_URL      API server URL
  ANTHROPIC_API_KEY        Anthropic API key for AI analysis

Examples:
  # Review Python files
  npx ts-node scripts/ci-review.ts src/**/*.py

  # Output SARIF for GitHub Actions
  npx ts-node scripts/ci-review.ts --format sarif --output results.sarif src/**/*.py

  # Strict mode for CI
  npx ts-node scripts/ci-review.ts --fail-on-critical --threshold 80 src/**/*.py

  # Review PR changes
  git diff --name-only origin/main | xargs npx ts-node scripts/ci-review.ts --include-diff
`);
}

async function expandGlobs(patterns: string[]): Promise<string[]> {
  const files: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const matches = await glob(pattern, { nodir: true });
      files.push(...matches);
    } else if (fs.existsSync(pattern)) {
      const stat = fs.statSync(pattern);
      if (stat.isFile()) {
        files.push(pattern);
      } else if (stat.isDirectory()) {
        const dirFiles = await glob(`${pattern}/**/*`, { nodir: true });
        files.push(...dirFiles);
      }
    }
  }

  return [...new Set(files)]; // Remove duplicates
}

function shouldSkip(filePath: string, skipPatterns: string[]): boolean {
  for (const pattern of skipPatterns) {
    const regex = new RegExp(
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
    );
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}

async function getGitDiff(filePath: string): Promise<string | undefined> {
  try {
    const { execSync } = await import('child_process');
    const diff = execSync(`git diff HEAD -- "${filePath}"`, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    });
    return diff || undefined;
  } catch {
    return undefined;
  }
}

async function callReviewAPI(
  files: Array<{ path: string; content: string; diff?: string }>,
  options: CLIOptions
): Promise<ReviewResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.apiKey) {
    headers['x-anthropic-api-key'] = options.apiKey;
  }

  const response = await fetch(`${options.apiUrl}/review/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      files,
      options: {
        threshold: options.threshold,
        format: 'json',
        failOnCritical: options.failOnCritical,
        failOnHigh: options.failOnHigh,
        skipPatterns: options.skipPatterns,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} - ${error}`);
  }

  return response.json();
}

function printSummary(result: ReviewResult): void {
  const { summary } = result;
  const statusIcon = summary.passThreshold ? '✅' : '❌';

  console.log('\n' + '='.repeat(60));
  console.log('CODE REVIEW SUMMARY');
  console.log('='.repeat(60) + '\n');

  console.log(`Status: ${statusIcon} ${summary.passThreshold ? 'PASSED' : 'FAILED'}`);
  console.log(`Average Score: ${summary.averageScore}/100`);
  console.log(`Threshold: ${summary.passThreshold ? '≥' : '<'} required minimum\n`);

  console.log('Files:');
  console.log(`  Total analyzed: ${summary.totalFiles}`);
  console.log(`  With issues: ${summary.filesWithIssues}\n`);

  console.log('Issues by severity:');
  if (summary.criticalCount > 0) console.log(`  🔴 Critical: ${summary.criticalCount}`);
  if (summary.highCount > 0) console.log(`  🟠 High: ${summary.highCount}`);
  if (summary.mediumCount > 0) console.log(`  🟡 Medium: ${summary.mediumCount}`);
  if (summary.lowCount > 0) console.log(`  🔵 Low: ${summary.lowCount}`);
  if (summary.infoCount > 0) console.log(`  ℹ️  Info: ${summary.infoCount}`);
  console.log(`  Total: ${summary.totalIssues}\n`);

  console.log(`Recommendation: ${summary.recommendation}\n`);

  // Show top issues
  const topIssues = result.files
    .flatMap(f => f.issues.map(i => ({ ...i, file: f.path })))
    .filter(i => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 5);

  if (topIssues.length > 0) {
    console.log('Top issues to address:');
    topIssues.forEach((issue, idx) => {
      const icon = issue.severity === 'critical' ? '🔴' : '🟠';
      console.log(`  ${idx + 1}. ${icon} ${issue.file}${issue.lineNumber ? `:${issue.lineNumber}` : ''}`);
      console.log(`     ${issue.message}`);
    });
    console.log('');
  }

  console.log('='.repeat(60) + '\n');
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.files.length === 0) {
    console.error('Error: No files specified. Use --help for usage information.');
    process.exit(1);
  }

  // Expand glob patterns
  const allFiles = await expandGlobs(options.files);

  // Filter out skipped files
  const filesToReview = allFiles.filter(f => !shouldSkip(f, options.skipPatterns));

  if (filesToReview.length === 0) {
    console.log('No files to review after filtering.');
    process.exit(0);
  }

  if (options.verbose) {
    console.log(`Found ${allFiles.length} files, reviewing ${filesToReview.length} after filtering`);
  }

  if (options.dryRun) {
    console.log('Files to review:');
    filesToReview.forEach(f => console.log(`  ${f}`));
    process.exit(0);
  }

  // Read file contents
  const files: Array<{ path: string; content: string; diff?: string }> = [];

  for (const filePath of filesToReview) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const diff = options.includeDiff ? await getGitDiff(filePath) : undefined;
      files.push({ path: filePath, content, diff });

      if (options.verbose) {
        console.log(`Read: ${filePath} (${content.length} bytes)`);
      }
    } catch (err: any) {
      console.warn(`Warning: Could not read ${filePath}: ${err.message}`);
    }
  }

  if (files.length === 0) {
    console.error('Error: No readable files found.');
    process.exit(1);
  }

  // Call API
  if (options.verbose) {
    console.log(`\nSending ${files.length} files to ${options.apiUrl}/review/batch`);
  }

  let result: ReviewResult;
  try {
    result = await callReviewAPI(files, options);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // Output results
  let output: string;

  switch (options.format) {
    case 'json':
      output = JSON.stringify(result, null, 2);
      break;
    case 'markdown':
      output = generateMarkdown(result);
      break;
    case 'sarif':
      output = JSON.stringify(generateSARIF(result), null, 2);
      break;
    case 'summary':
    default:
      printSummary(result);
      output = '';
  }

  if (output) {
    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(`Report written to: ${options.output}`);
    } else {
      console.log(output);
    }
  }

  // Determine exit code
  const { summary } = result;
  let exitCode = 0;

  if (options.failOnCritical && summary.criticalCount > 0) {
    console.error(`\nFailing due to ${summary.criticalCount} critical issue(s)`);
    exitCode = 1;
  } else if (options.failOnHigh && summary.highCount > 0) {
    console.error(`\nFailing due to ${summary.highCount} high severity issue(s)`);
    exitCode = 1;
  } else if (!summary.passThreshold) {
    console.error(`\nFailing due to score (${summary.averageScore}) below threshold`);
    exitCode = 1;
  }

  process.exit(exitCode);
}

function generateMarkdown(result: ReviewResult): string {
  const lines: string[] = [];
  const { summary } = result;

  lines.push('# Code Review Report\n');
  lines.push(`**Status:** ${summary.passThreshold ? '✅ PASSED' : '❌ FAILED'}\n`);
  lines.push(`**Average Score:** ${summary.averageScore}/100\n`);

  lines.push('## Summary\n');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Files Analyzed | ${summary.totalFiles} |`);
  lines.push(`| Total Issues | ${summary.totalIssues} |`);
  lines.push(`| Critical | ${summary.criticalCount} |`);
  lines.push(`| High | ${summary.highCount} |`);
  lines.push('\n');

  lines.push('## File Results\n');

  for (const file of result.files) {
    if (file.issues.length === 0) continue;

    lines.push(`### ${file.path}\n`);
    lines.push(`**Score:** ${file.score}/100 | **Issues:** ${file.issues.length}\n`);

    for (const issue of file.issues) {
      const icon = issue.severity === 'critical' ? '🔴' :
                   issue.severity === 'high' ? '🟠' :
                   issue.severity === 'medium' ? '🟡' : '🔵';
      lines.push(`- ${icon} **${issue.severity.toUpperCase()}**: ${issue.message}`);
      if (issue.lineNumber) lines.push(`  - Line: ${issue.lineNumber}`);
      if (issue.suggestion) lines.push(`  - Fix: ${issue.suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateSARIF(result: ReviewResult): object {
  const rules: any[] = [];
  const results: any[] = [];

  for (const file of result.files) {
    for (const issue of file.issues) {
      const ruleId = `${issue.category.substring(0, 3).toUpperCase()}-${Math.abs(issue.message.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)).toString(16).substring(0, 6)}`;

      if (!rules.find(r => r.id === ruleId)) {
        rules.push({
          id: ruleId,
          name: issue.category,
          shortDescription: { text: issue.message.substring(0, 100) },
          defaultConfiguration: {
            level: issue.severity === 'critical' || issue.severity === 'high' ? 'error' : 'warning',
          },
        });
      }

      results.push({
        ruleId,
        level: issue.severity === 'critical' || issue.severity === 'high' ? 'error' : 'warning',
        message: { text: issue.message },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: file.path },
            region: issue.lineNumber ? { startLine: issue.lineNumber } : undefined,
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
          rules,
        },
      },
      results,
    }],
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
