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
