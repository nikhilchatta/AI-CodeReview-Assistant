import * as vscode from 'vscode';

export interface CodeReviewConfig {
  serverUrl: string;
  autoReviewOnSave: boolean;
  apiKey: string;
  severityFilter: string[];
}

export function getConfig(): CodeReviewConfig {
  const cfg = vscode.workspace.getConfiguration('codereview');
  return {
    serverUrl: cfg.get<string>('serverUrl', 'http://localhost:5001'),
    autoReviewOnSave: cfg.get<boolean>('autoReviewOnSave', false),
    apiKey: cfg.get<string>('apiKey', ''),
    severityFilter: cfg.get<string[]>('severityFilter', ['critical', 'high', 'medium', 'low']),
  };
}

/** Map VS Code language ID to code review language key */
export function mapLanguage(languageId: string, code: string): string | null {
  switch (languageId) {
    case 'python':
      return /(?:from|import)\s+pyspark/.test(code) ? 'pyspark' : 'python';
    case 'scala':
      return 'scala';
    case 'sql':
      return 'sql';
    case 'terraform':
    case 'hcl':
      return 'terraform';
    default:
      return null;
  }
}
