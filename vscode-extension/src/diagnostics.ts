import * as vscode from 'vscode';
import type { ReviewIssue } from './reviewer';

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  high: vscode.DiagnosticSeverity.Error,
  medium: vscode.DiagnosticSeverity.Warning,
  low: vscode.DiagnosticSeverity.Information,
  info: vscode.DiagnosticSeverity.Hint,
};

/** Store suggestions keyed by diagnostic for code actions */
export const suggestionMap = new Map<string, string>();

/** Store refactored code keyed by document URI */
const refactoredCodeMap = new Map<string, string>();

export function setRefactoredCode(uri: string, code: string) {
  refactoredCodeMap.set(uri, code);
}

export function getRefactoredCode(uri: string): string | undefined {
  return refactoredCodeMap.get(uri);
}

export function clearRefactoredCode(uri: string) {
  refactoredCodeMap.delete(uri);
}

export function clearSuggestions() {
  suggestionMap.clear();
}

export function mapIssuesToDiagnostics(
  issues: ReviewIssue[],
  document: vscode.TextDocument,
  severityFilter: string[],
): vscode.Diagnostic[] {
  suggestionMap.clear();

  return issues
    .filter(issue => severityFilter.includes(issue.severity))
    .map(issue => {
      const line = Math.max(0, (issue.lineNumber ?? 1) - 1);
      const safeLine = Math.min(line, document.lineCount - 1);
      const range = document.lineAt(safeLine).range;

      const diag = new vscode.Diagnostic(
        range,
        `[${issue.severity.toUpperCase()}] ${issue.message}`,
        SEVERITY_MAP[issue.severity] ?? vscode.DiagnosticSeverity.Warning,
      );

      diag.source = 'AI Code Review';
      diag.code = issue.category;

      if (issue.suggestion) {
        const key = `${document.uri.toString()}:${safeLine}`;
        suggestionMap.set(key, issue.suggestion);
      }

      return diag;
    });
}

/**
 * CodeActionProvider that offers quick-fix suggestions from AI Code Review.
 */
export class CodeReviewCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Check if we have Code Review diagnostics
    const reviewDiags = context.diagnostics.filter(d => d.source === 'AI Code Review');
    if (reviewDiags.length === 0) return actions;

    // Add action to apply full refactored code if available
    const refactoredCode = getRefactoredCode(document.uri.toString());
    if (refactoredCode) {
      const applyAllAction = new vscode.CodeAction(
        'Code Review: Apply All Fixes (Refactored Code)',
        vscode.CodeActionKind.QuickFix,
      );
      applyAllAction.diagnostics = reviewDiags;
      applyAllAction.command = {
        command: 'codereview.applyRefactoredCode',
        title: 'Apply Refactored Code',
      };
      actions.push(applyAllAction);

      // Add action to view diff
      const diffAction = new vscode.CodeAction(
        'Code Review: View Refactored Code (Diff)',
        vscode.CodeActionKind.QuickFix,
      );
      diffAction.diagnostics = reviewDiags;
      diffAction.command = {
        command: 'codereview.showRefactoredCode',
        title: 'Show Refactored Code',
      };
      actions.push(diffAction);
    }

    // Add per-issue suggestion actions
    for (const diag of reviewDiags) {
      const key = `${document.uri.toString()}:${diag.range.start.line}`;
      const suggestion = suggestionMap.get(key);
      if (!suggestion) continue;

      const action = new vscode.CodeAction(
        `Code Review: ${suggestion}`,
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];

      // Insert suggestion as a comment above the line
      const edit = new vscode.WorkspaceEdit();
      const insertPos = new vscode.Position(diag.range.start.line, 0);
      const indent = document.lineAt(diag.range.start.line).text.match(/^\s*/)?.[0] || '';
      edit.insert(document.uri, insertPos, `${indent}# TODO (Code Review): ${suggestion}\n`);
      action.edit = edit;

      actions.push(action);
    }

    return actions;
  }
}
