export interface CodeIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  lineNumber?: number;
  suggestion?: string;
  codeSnippet?: string;
  fixedCode?: string;
  validationSource?: 'internal' | 'external' | 'both';
}

export interface CodeReviewResult {
  overallScore: number;
  codeQuality: number;
  performance: number;
  security: number;
  maintainability: number;
  issues: CodeIssue[];
  strengths: string[];
  recommendations: string[];
  estimatedRefactoringEffort: string;
  summary: string;
  fixedCode?: string;
  originalCode?: string;
  aiApiUnavailable?: boolean;
  aiApiError?: string;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
}

export interface AICodeIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  lineNumber?: number;
  suggestion: string;
  codeSnippet?: string;
  reasoning?: string;
}

export interface AIAnalysisResult {
  issues: AICodeIssue[];
  strengths: string[];
  recommendations: string[];
  refactoredCode?: string;
  analysisTime: number;
  error?: string;
  apiUnavailable?: boolean;
}

export interface ValidationRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern?: RegExp | string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'security' | 'performance' | 'code-structure' | 'maintainability' | 'data-quality' | 'best-practice' | 'logging' | 'exception-handling';
  message: string;
  suggestion: string;
  languages: ('pyspark' | 'python' | 'scala' | 'sql' | 'terraform')[];
  checkFunction?: (code: string) => boolean;
}

export interface ValidationStandards {
  pyspark: ValidationRule[];
  python: ValidationRule[];
  scala: ValidationRule[];
  sql: ValidationRule[];
  terraform: ValidationRule[];
  security: ValidationRule[];
  common: ValidationRule[];
}

export type SupportedLanguage = 'pyspark' | 'python' | 'scala' | 'sql' | 'terraform';

// ── Observability Metrics ──

export interface WorkflowMetric {
  id: number;
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
  cost_usd: number;
  pr_number?: number;
  branch?: string;
  triggered_by?: string;
}

export interface MetricsSummary {
  total_runs: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  total_tokens_consumed: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  avg_latency_ms: number;
  avg_tokens_per_run: number;
  total_files_reviewed: number;
  total_issues_found: number;
  total_critical: number;
  total_high: number;
  total_cost_usd: number;
  avg_cost_per_run: number;
  repositories: number;
  projects: number;
}

export interface ProjectInfo {
  project_id: string;
  repository: string;
  run_count: number;
  last_run: string;
  success_rate: number;
  total_cost_usd: number;
}
