/**
 * Server-side pattern rule engine — mirrors the client-side validation-rules.ts
 * so that /api/analyze-code can run the same dual-layer analysis (pattern + AI)
 * and deduplicate results, producing consistent output for both the web UI and
 * the VS Code extension.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PatternRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern?: RegExp | string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  suggestion: string;
  languages: string[];
  checkFunction?: (code: string) => boolean;
}

export interface PatternIssue {
  severity: string;
  category: string;
  message: string;
  suggestion: string;
  lineNumber?: number;
}

// ── Rules (kept in sync with src/engine/validation-rules.ts) ─────────────────

const pysparkRules: PatternRule[] = [
  { id: 'pyspark-001', name: 'Missing Docstrings', enabled: true, severity: 'medium', category: 'code-structure', message: 'Missing docstrings for documentation and troubleshooting', suggestion: 'Add docstrings: """Process data pipeline."""', languages: ['pyspark', 'python'], checkFunction: (code) => !code.includes('"""') && !code.includes("'''") },
  { id: 'pyspark-002', name: 'Schema Inference', enabled: true, pattern: /inferSchema\s*=\s*True/i, severity: 'critical', category: 'performance', message: 'Schema inference instead of explicit schemas', suggestion: 'Use explicit schemas: spark.read.schema(mySchema).csv(path)', languages: ['pyspark'] },
  { id: 'pyspark-003', name: 'Collect Usage', enabled: true, pattern: /\.collect\(\)/, severity: 'high', category: 'performance', message: 'Using collect() brings all data to driver - can cause OOM on large datasets', suggestion: 'Use .take(n) for sampling or write to storage', languages: ['pyspark'] },
  { id: 'pyspark-004', name: 'ToPandas Usage', enabled: true, pattern: /\.toPandas\(\)/, severity: 'high', category: 'performance', message: 'toPandas() collects all data to driver memory', suggestion: 'Process data with Spark operations instead', languages: ['pyspark'] },
  { id: 'pyspark-005', name: 'RDD API Usage', enabled: true, pattern: /\.rdd|RDD\[/, severity: 'medium', category: 'best-practice', message: 'Using RDD API instead of DataFrame/Dataset', suggestion: 'Use DataFrame operations instead of RDD transformations', languages: ['pyspark'] },
  { id: 'pyspark-006', name: 'UDF Usage', enabled: true, pattern: /@udf|udf\(/, severity: 'medium', category: 'performance', message: 'UDF usage detected - prefer built-in Spark functions', suggestion: 'Replace UDF with built-in functions like when/otherwise', languages: ['pyspark'] },
  { id: 'pyspark-007', name: 'System Exit', enabled: true, pattern: /sys\.exit|exit\(/, severity: 'high', category: 'exception-handling', message: 'System.exit() usage in Spark jobs', suggestion: 'Throw exceptions instead: raise RuntimeError("Error message")', languages: ['pyspark', 'python'] },
  { id: 'pyspark-008', name: 'Print Statements', enabled: true, pattern: /\bprint\(|println\(/, severity: 'low', category: 'logging', message: 'Using print() instead of proper logging', suggestion: 'Use loggers: logger.info("Processing data")', languages: ['pyspark', 'python'] },
  { id: 'pyspark-009', name: 'Debug Statements', enabled: true, pattern: /\.show\(\)|\.printSchema\(\)/, severity: 'low', category: 'logging', message: 'Debug statements left in code', suggestion: 'Remove .show(), .printSchema() calls', languages: ['pyspark'] },
  { id: 'pyspark-010', name: 'Missing Broadcast Join', enabled: true, pattern: /\.join\(/, severity: 'low', category: 'performance', message: 'Consider broadcast joins for small dimension tables', suggestion: 'Use broadcast: df1.join(broadcast(df2), "key")', languages: ['pyspark'] },
  { id: 'pyspark-011', name: 'Select All Columns', enabled: true, pattern: /select\("\*"\)|\.select\(\)/, severity: 'low', category: 'performance', message: 'Selecting all columns unnecessarily', suggestion: 'Specify columns: df.select("col1", "col2")', languages: ['pyspark'] },
  { id: 'pyspark-012', name: 'Missing Repartition', enabled: true, pattern: /\.write\./, severity: 'low', category: 'performance', message: 'Potential small file creation', suggestion: 'Use coalesce() or repartition() before writing', languages: ['pyspark'] },
];

const scalaRules: PatternRule[] = [
  { id: 'scala-001', name: 'Mutable Variables', enabled: true, pattern: /\bvar\s+/, severity: 'low', category: 'best-practice', message: 'Prefer val over var for immutability', suggestion: 'Use val instead of var where possible', languages: ['scala'] },
  { id: 'scala-002', name: 'Unsafe Option Handling', enabled: true, pattern: /\.get\b(?!\()/, severity: 'medium', category: 'exception-handling', message: 'Using .get without checking if Option is defined', suggestion: 'Use .getOrElse() or pattern matching', languages: ['scala'] },
  { id: 'scala-003', name: 'Null Checks', enabled: true, pattern: /!=\s*null|==\s*null/, severity: 'medium', category: 'best-practice', message: 'Using null checks instead of Option', suggestion: 'Use Option type: Option(value).map(...).getOrElse(...)', languages: ['scala'] },
  { id: 'scala-004', name: 'Resource Leak', enabled: true, pattern: /DriverManager\.getConnection/, severity: 'high', category: 'exception-handling', message: 'Potential resource leak - connection not closed', suggestion: 'Use try-with-resources or ensure .close() is called', languages: ['scala'] },
  { id: 'scala-005', name: 'Generic Exception Catch', enabled: true, pattern: /catch\s*\{\s*case\s+e:\s*Exception/, severity: 'medium', category: 'exception-handling', message: 'Catching generic Exception - too broad', suggestion: 'Catch specific exceptions', languages: ['scala'] },
  { id: 'scala-006', name: 'System Exit', enabled: true, pattern: /System\.exit/, severity: 'high', category: 'exception-handling', message: 'System.exit() usage in Spark jobs', suggestion: 'Throw exceptions instead: throw new RuntimeException("Error")', languages: ['scala'] },
  { id: 'scala-007', name: 'Collect on Large DataFrame', enabled: true, pattern: /\.collect\(\)/, severity: 'high', category: 'performance', message: 'Using .collect() can cause OutOfMemoryError on large DataFrames', suggestion: 'Use .take(n), .head(n), or .foreach() instead of .collect()', languages: ['scala'] },
  { id: 'scala-008', name: 'SQL Injection Risk', enabled: true, pattern: /spark\.sql\(s"/, severity: 'critical', category: 'security', message: 'String interpolation in spark.sql() - SQL injection vulnerability', suggestion: 'Use parameterized queries or sanitize inputs before interpolation', languages: ['scala'] },
  { id: 'scala-009', name: 'Redundant Repartition', enabled: true, severity: 'high', category: 'performance', message: 'Redundant repartition - multiple consecutive repartitions cause unnecessary shuffles', suggestion: 'Keep only the final repartition call', languages: ['scala'], checkFunction: (code) => { const lines = code.split('\n'); for (let i = 0; i < lines.length - 1; i++) { if (lines[i].includes('.repartition(') && lines[i + 1]?.includes('.repartition(')) return true; } return false; } },
  { id: 'scala-010', name: 'Multiple Separate Filters', enabled: true, severity: 'medium', category: 'performance', message: 'Multiple separate .filter() calls - consider combining for better performance', suggestion: 'Combine filters: .filter(cond1 && cond2 && cond3)', languages: ['scala'], checkFunction: (code) => (code.match(/\.filter\(/g) || []).length >= 3 },
  { id: 'scala-011', name: 'Blocking Operation in Transformation', enabled: true, pattern: /scala\.io\.Source\.fromURL/, severity: 'critical', category: 'performance', message: 'Blocking HTTP call inside Spark transformation', suggestion: 'Use mapPartitions with connection pooling, or pre-fetch data and broadcast', languages: ['scala'] },
  { id: 'scala-012', name: 'Memory Leak', enabled: true, pattern: /dataFrames\s*=\s*dataFrames\s*:\+/, severity: 'high', category: 'performance', message: 'Accumulating DataFrames in a collection causes memory leak', suggestion: 'Process and release DataFrames in each iteration', languages: ['scala'] },
  { id: 'scala-013', name: 'Missing Persist', enabled: true, severity: 'high', category: 'performance', message: 'Expensive computation reused multiple times without persist/cache', suggestion: 'Call .persist(StorageLevel.MEMORY_AND_DISK) on expensive DataFrames reused across actions', languages: ['scala'], checkFunction: (code) => { const hasJoins = (code.match(/\.join\(/g) || []).length >= 2; const hasMultipleActions = (code.match(/\.(count|agg|collect|show|write)\(/g) || []).length >= 2; const hasPersist = code.includes('.persist(') || code.includes('.cache()'); return hasJoins && hasMultipleActions && !hasPersist; } },
  { id: 'scala-014', name: 'Unpartitioned Write', enabled: true, severity: 'medium', category: 'performance', message: 'Writing large dataset without partitioning', suggestion: 'Use .partitionBy("date", "region") for better query performance on reads', languages: ['scala'], checkFunction: (code) => code.includes('.write') && code.includes('.parquet(') && !code.includes('.partitionBy(') },
  { id: 'scala-015', name: 'Hardcoded S3 Path', enabled: true, pattern: /"s3:\/\/[^"]*\d{4}[^"]*"/, severity: 'medium', category: 'maintainability', message: 'Hardcoded S3 path with date', suggestion: 'Use config files or environment variables for paths', languages: ['scala'] },
  { id: 'scala-016', name: 'Println Usage', enabled: true, pattern: /println\(/, severity: 'low', category: 'logging', message: 'Using println instead of structured logging', suggestion: 'Use SLF4J Logger: logger.info(...)', languages: ['scala'] },
  { id: 'scala-017', name: 'Missing Schema Definition', enabled: true, severity: 'medium', category: 'data-quality', message: 'Reading data without explicit schema', suggestion: 'Define explicit StructType schema for type safety and performance', languages: ['scala'], checkFunction: (code) => (code.includes('.read.json(') || code.includes('.read.csv(')) && !code.includes('.schema(') },
];

const sqlRules: PatternRule[] = [
  { id: 'sql-001', name: 'Select All Columns', enabled: true, pattern: /SELECT\s+\*/i, severity: 'medium', category: 'best-practice', message: 'SELECT * retrieves all columns - specify only needed columns', suggestion: 'Specify columns: SELECT id, name, date', languages: ['sql'] },
  { id: 'sql-002', name: 'Delete Without Where', enabled: true, pattern: /DELETE\s+FROM\s+\w+\s*;/i, severity: 'critical', category: 'security', message: 'DELETE without WHERE clause will remove all rows!', suggestion: 'Add WHERE clause or use TRUNCATE if intentional', languages: ['sql'] },
  { id: 'sql-003', name: 'Function on Indexed Column', enabled: true, pattern: /YEAR\(|MONTH\(|DAY\(/i, severity: 'high', category: 'performance', message: 'Function on date column in WHERE clause prevents index usage', suggestion: "Use range: WHERE date >= '2024-01-01' AND date < '2025-01-01'", languages: ['sql'] },
  { id: 'sql-004', name: 'Not In With Nulls', enabled: true, pattern: /NOT\s+IN\s*\(/i, severity: 'medium', category: 'data-quality', message: 'NOT IN can cause unexpected results with NULL values', suggestion: 'Use NOT EXISTS or LEFT JOIN with NULL check', languages: ['sql'] },
  { id: 'sql-005', name: 'Correlated Subquery', enabled: true, pattern: /\bIN\s*\(\s*SELECT/i, severity: 'medium', category: 'performance', message: 'Correlated subquery detected - can cause performance issues', suggestion: 'Use JOIN or EXISTS instead', languages: ['sql'] },
  { id: 'sql-006', name: 'Raw Table Access', enabled: true, pattern: /\b(FROM|JOIN)\s+raw_\w+/i, severity: 'medium', category: 'maintainability', message: 'Direct access to raw tables detected', suggestion: 'Use processed/cleaned tables or views', languages: ['sql'] },
  { id: 'sql-007', name: 'Hardcoded Values', enabled: true, pattern: /WHERE.*=\s*['"](?!NULL)[^'"]+['"]|VALUES\s*\([^)]*['"][^'"]+['"]/i, severity: 'medium', category: 'maintainability', message: 'Hardcoded values in SQL - should use parameters', suggestion: 'Use parameters: @start_date, @segment_type', languages: ['sql'] },
  { id: 'sql-008', name: 'Missing Partitioning', enabled: true, pattern: /GROUP BY|ORDER BY/i, severity: 'low', category: 'performance', message: 'No partitioning strategy mentioned - consider for large datasets', suggestion: 'Add partitioning: PARTITION BY date', languages: ['sql'] },
  { id: 'sql-009', name: 'Missing Limit', enabled: true, pattern: /SELECT\s+.*\s+FROM/i, severity: 'low', category: 'performance', message: 'No LIMIT clause - query may return millions of rows', suggestion: 'Add LIMIT for testing: LIMIT 1000', languages: ['sql'] },
  { id: 'sql-010', name: 'Cartesian Join', enabled: true, pattern: /FROM\s+\w+\s*,\s*\w+(?!\s+ON)/i, severity: 'critical', category: 'performance', message: 'Cartesian join detected - missing JOIN condition', suggestion: 'Add JOIN condition: FROM t1 JOIN t2 ON t1.id = t2.id', languages: ['sql'] },
];

const securityRules: PatternRule[] = [
  { id: 'security-001', name: 'Hardcoded Password', enabled: true, pattern: /password\s*=\s*['"][^'"]+['"]/i, severity: 'critical', category: 'security', message: 'Hardcoded password detected!', suggestion: 'Use environment variables, secrets manager, or Databricks secrets', languages: ['pyspark', 'python', 'scala', 'sql'] },
  { id: 'security-002', name: 'Hardcoded Credentials', enabled: true, pattern: /(api_key|apikey|secret|token|access_key)\s*=\s*['"][^'"]+['"]/i, severity: 'critical', category: 'security', message: 'Hardcoded credentials detected!', suggestion: 'Use environment variables or secrets manager', languages: ['pyspark', 'python', 'scala', 'sql'] },
  { id: 'security-003', name: 'SQL Injection Risk', enabled: true, pattern: /spark\.sql\([^)]*\+|execute\([^)]*\+|executeQuery\([^)]*\+/i, severity: 'critical', category: 'security', message: 'Potential SQL injection vulnerability', suggestion: 'Use parameterized queries or prepared statements', languages: ['pyspark', 'python', 'scala', 'sql'] },
  { id: 'security-004', name: 'Unencrypted Connection', enabled: true, pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/i, severity: 'high', category: 'security', message: 'Unencrypted HTTP connection detected', suggestion: 'Use HTTPS for secure communication', languages: ['pyspark', 'python', 'scala', 'sql'] },
  { id: 'security-005', name: 'AWS Keys in Code', enabled: true, pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical', category: 'security', message: 'AWS Access Key detected in code!', suggestion: 'Remove immediately and use IAM roles or AWS Secrets Manager', languages: ['pyspark', 'python', 'scala', 'sql'] },
  { id: 'security-006', name: 'Private Key', enabled: true, pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, severity: 'critical', category: 'security', message: 'Private key detected in code!', suggestion: 'Remove immediately and use proper key management', languages: ['pyspark', 'python', 'scala', 'sql'] },
  { id: 'security-007', name: 'Database Credentials', enabled: true, pattern: /jdbc:[^"']*\/\/[^"']*:[^"']*@/, severity: 'high', category: 'security', message: 'Database credentials in connection string', suggestion: 'Use secrets management or connection pooling', languages: ['pyspark', 'python', 'scala'] },
];

const commonRules: PatternRule[] = [
  { id: 'common-001', name: 'Hardcoded File Paths', enabled: true, pattern: /["']\/[a-zA-Z0-9_\/-]+["']|["'][A-Z]:\\[^"']+["']/, severity: 'medium', category: 'maintainability', message: 'Hardcoded file paths detected', suggestion: 'Use configuration files: config.get("input.path")', languages: ['pyspark', 'python', 'scala'] },
  { id: 'common-002', name: 'Hardcoded Dates', enabled: true, pattern: /\b\d{4}-\d{2}-\d{2}\b/, severity: 'medium', category: 'maintainability', message: 'Hardcoded dates detected', suggestion: 'Use date parameters or configuration', languages: ['pyspark', 'python', 'scala', 'sql'] },
  { id: 'common-003', name: 'Magic Numbers', enabled: true, pattern: /[^a-zA-Z_]\d{3,}[^a-zA-Z_]/, severity: 'low', category: 'maintainability', message: 'Magic numbers detected - use named constants', suggestion: 'Define constants: MAX_RETRIES = 100', languages: ['pyspark', 'python', 'scala'] },
];

const pythonRules: PatternRule[] = [
  { id: 'python-001', name: 'Missing Type Hints', enabled: true, severity: 'low', category: 'code-structure', message: 'Missing type hints for function parameters and return values', suggestion: 'Add type hints: def process_data(input: str) -> Dict[str, Any]:', languages: ['python'], checkFunction: (code) => { const hasFunctions = /def\s+\w+\s*\(/.test(code); const hasTypeHints = /def\s+\w+\s*\([^)]*:\s*\w+/.test(code) || /\)\s*->\s*\w+/.test(code); return hasFunctions && !hasTypeHints; } },
  { id: 'python-002', name: 'Bare Except', enabled: true, pattern: /except\s*:/, severity: 'medium', category: 'exception-handling', message: 'Bare except clause catches all exceptions including system exits', suggestion: 'Specify exceptions: except (ValueError, TypeError) as e:', languages: ['python'] },
  { id: 'python-003', name: 'Mutable Default Arguments', enabled: true, pattern: /def\s+\w+\([^)]*=\s*\[|def\s+\w+\([^)]*=\s*\{/, severity: 'high', category: 'best-practice', message: 'Mutable default arguments can cause unexpected behavior', suggestion: 'Use None as default: def func(items=None): items = items or []', languages: ['python'] },
  { id: 'python-004', name: 'Print for Logging', enabled: true, pattern: /\bprint\(/, severity: 'low', category: 'logging', message: 'Using print() instead of proper logging', suggestion: 'Use logging module: logging.info("Message")', languages: ['python'] },
  { id: 'python-005', name: 'Global Variables', enabled: true, pattern: /\bglobal\s+\w+/, severity: 'medium', category: 'best-practice', message: 'Global variables make code harder to test and maintain', suggestion: 'Pass variables as parameters or use class attributes', languages: ['python'] },
  { id: 'python-006', name: 'String Concatenation in Loops', enabled: true, severity: 'medium', category: 'performance', message: 'String concatenation in loops is inefficient', suggestion: 'Use list and join: parts = []; parts.append(x); result = "".join(parts)', languages: ['python'], checkFunction: (code) => (code.includes('for ') || code.includes('while ')) && /\+\s*["']/.test(code) },
];

const terraformRules: PatternRule[] = [
  { id: 'terraform-001', name: 'Hardcoded Credentials', enabled: true, pattern: /(access_key|secret_key|password|token)\s*=\s*["'][^"']+["']/i, severity: 'critical', category: 'security', message: 'Hardcoded credentials in Terraform code!', suggestion: 'Use variables or AWS Secrets Manager: var.db_password', languages: ['terraform'] },
  { id: 'terraform-002', name: 'Missing Provider Version', enabled: true, severity: 'high', category: 'best-practice', message: 'Provider version not specified', suggestion: 'Specify provider version: required_providers { aws = { version = "~> 4.0" } }', languages: ['terraform'], checkFunction: (code) => code.includes('provider "') && !code.includes('required_providers') },
  { id: 'terraform-003', name: 'No Backend Configuration', enabled: true, severity: 'medium', category: 'best-practice', message: 'No remote backend configured - state stored locally', suggestion: 'Configure remote backend: terraform { backend "s3" { bucket = "..." } }', languages: ['terraform'], checkFunction: (code) => code.includes('terraform {') && !code.includes('backend') },
  { id: 'terraform-004', name: 'Public S3 Bucket', enabled: true, pattern: /acl\s*=\s*["']public-read["']/i, severity: 'critical', category: 'security', message: 'S3 bucket configured with public read access!', suggestion: 'Use private ACL: acl = "private"', languages: ['terraform'] },
  { id: 'terraform-005', name: 'Missing Resource Tags', enabled: true, severity: 'low', category: 'best-practice', message: 'Resources missing tags for cost tracking', suggestion: 'Add tags: tags = { Environment = var.environment }', languages: ['terraform'], checkFunction: (code) => code.includes('resource "') && !code.includes('tags ') },
  { id: 'terraform-006', name: 'Unencrypted Storage', enabled: true, severity: 'high', category: 'security', message: 'Storage resource without encryption enabled', suggestion: 'Enable encryption: server_side_encryption_configuration { ... }', languages: ['terraform'], checkFunction: (code) => code.includes('aws_s3_bucket') && !code.includes('server_side_encryption') },
  { id: 'terraform-007', name: 'Wide Security Group Rules', enabled: true, pattern: /cidr_blocks\s*=\s*\[["']0\.0\.0\.0\/0["']\]/, severity: 'high', category: 'security', message: 'Security group rule allows access from anywhere (0.0.0.0/0)', suggestion: 'Restrict to specific CIDR blocks', languages: ['terraform'] },
  { id: 'terraform-008', name: 'Missing Variables Description', enabled: true, severity: 'low', category: 'maintainability', message: 'Variable missing description', suggestion: 'Add description: variable "name" { description = "..." }', languages: ['terraform'], checkFunction: (code) => code.includes('variable "') && !code.includes('description ') },
  { id: 'terraform-009', name: 'Default VPC Usage', enabled: true, pattern: /default\s*=\s*true/i, severity: 'medium', category: 'security', message: 'Using default VPC which may have insecure settings', suggestion: 'Create custom VPC with explicit security settings', languages: ['terraform'] },
];

// ── Rule lookup ──────────────────────────────────────────────────────────────

const ALL_RULES: PatternRule[] = [
  ...pysparkRules, ...pythonRules, ...scalaRules, ...sqlRules,
  ...terraformRules, ...securityRules, ...commonRules,
];

export function getEnabledRulesForLanguage(language: string): PatternRule[] {
  return ALL_RULES.filter(r => r.enabled && r.languages.includes(language));
}

// ── Pattern scanning ─────────────────────────────────────────────────────────

export function runPatternRules(code: string, language: string): PatternIssue[] {
  const rules = getEnabledRulesForLanguage(language);
  const lines = code.split('\n');
  const issues: PatternIssue[] = [];

  for (const rule of rules) {
    let matched = false;
    let matchedLine: number | undefined;

    if (rule.pattern) {
      const regex = typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'gi')
        : new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');

      if (regex.test(code)) {
        matched = true;
        // find first matching line
        const lineRegex = typeof rule.pattern === 'string'
          ? new RegExp(rule.pattern, 'i')
          : new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''));
        const idx = lines.findIndex(l => lineRegex.test(l));
        if (idx !== -1) matchedLine = idx + 1;
      }
    }

    if (!matched && rule.checkFunction) {
      matched = rule.checkFunction(code);
    }

    if (matched) {
      issues.push({
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
        suggestion: rule.suggestion,
        lineNumber: matchedLine,
      });
    }
  }

  return issues;
}

// ── Deduplication ────────────────────────────────────────────────────────────

export function isSimilarIssue(
  a: { message: string; lineNumber?: number; category: string },
  b: { message: string; lineNumber?: number; category: string },
): boolean {
  // Same line → duplicate
  if (a.lineNumber && b.lineNumber && a.lineNumber === b.lineNumber) return true;

  const m1 = a.message.toLowerCase();
  const m2 = b.message.toLowerCase();

  // Keyword overlap
  const keywords = ['collect', 'cache', 'broadcast', 'join', 'schema', 'password', 'credentials',
    'udf', 'rdd', 'partition', 'count', 'null', 'hardcoded'];
  for (const kw of keywords) {
    if (m1.includes(kw) && m2.includes(kw)) return true;
  }

  // Word-overlap within same category
  if (a.category === b.category) {
    const w1 = new Set(m1.split(/\s+/));
    const w2 = new Set(m2.split(/\s+/));
    let overlap = 0;
    for (const w of w2) { if (w1.has(w)) overlap++; }
    if (overlap / Math.max(w1.size, w2.size) > 0.6) return true;
  }

  return false;
}

/**
 * Merge pattern-rule issues with AI issues, deduplicating overlaps.
 * Returns a single deduplicated array.
 */
export function mergeIssues(
  patternIssues: PatternIssue[],
  aiIssues: Array<{ severity: string; category: string; message: string; lineNumber?: number; suggestion: string; reasoning?: string }>,
): Array<{ severity: string; category: string; message: string; lineNumber?: number; suggestion: string; reasoning?: string }> {
  const merged: Array<{ severity: string; category: string; message: string; lineNumber?: number; suggestion: string; reasoning?: string }> = [];

  // Start with pattern issues
  for (const pi of patternIssues) {
    merged.push({ ...pi, reasoning: undefined });
  }

  // Add AI issues, skipping duplicates
  for (const ai of aiIssues) {
    const dup = merged.find(existing => isSimilarIssue(existing, ai));
    if (dup) {
      // Enrich existing with AI reasoning
      if (ai.reasoning) {
        dup.reasoning = ai.reasoning;
        dup.suggestion = dup.suggestion + `\n\nAI Analysis: ${ai.reasoning}`;
      }
    } else {
      merged.push(ai);
    }
  }

  return merged;
}
