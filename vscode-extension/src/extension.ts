import * as vscode from 'vscode';
import { getConfig, mapLanguage } from './config';
import { reviewCode, ReviewResult } from './reviewer';
import { mapIssuesToDiagnostics, CodeReviewCodeActionProvider, setRefactoredCode, clearRefactoredCode, clearSuggestions } from './diagnostics';

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let saveListener: vscode.Disposable | undefined;

// Store the last review result per document for refactored code access
const lastReviewResults = new Map<string, ReviewResult>();

// Track documents that just had refactored code applied (skip auto-review on next save)
const skipNextAutoReview = new Set<string>();

export function activate(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('codereview');
  context.subscriptions.push(diagnosticCollection);

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'codereview.reviewFile';
  setStatusIdle();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codereview.reviewFile', () => runReview(false)),
    vscode.commands.registerCommand('codereview.reviewSelection', () => runReview(true)),
    vscode.commands.registerCommand('codereview.showRefactoredCode', showRefactoredCode),
    vscode.commands.registerCommand('codereview.applyRefactoredCode', applyRefactoredCode),
    vscode.commands.registerCommand('codereview.clearDiagnostics', () => {
      diagnosticCollection.clear();
      lastReviewResults.clear();
      setStatusIdle();
    }),
  );

  // Code action provider (quick-fix suggestions)
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [{ language: 'python' }, { language: 'scala' }, { language: 'sql' }, { language: 'terraform' }],
      new CodeReviewCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  // Auto-review on save
  setupAutoReview(context);
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('codereview.autoReviewOnSave')) {
      setupAutoReview(context);
    }
  });
}

function setupAutoReview(context: vscode.ExtensionContext) {
  if (saveListener) {
    saveListener.dispose();
    saveListener = undefined;
  }
  if (getConfig().autoReviewOnSave) {
    saveListener = vscode.workspace.onDidSaveTextDocument(doc => {
      // Skip auto-review if we just applied refactored code
      const uriStr = doc.uri.toString();
      if (skipNextAutoReview.has(uriStr)) {
        skipNextAutoReview.delete(uriStr);
        return;
      }
      const lang = mapLanguage(doc.languageId, doc.getText());
      if (lang) runReviewOnDocument(doc);
    });
    context.subscriptions.push(saveListener);
  }
}

async function runReview(selectionOnly: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const doc = editor.document;
  const code = selectionOnly && !editor.selection.isEmpty
    ? doc.getText(editor.selection)
    : doc.getText();

  await doReview(doc, code);
}

async function runReviewOnDocument(doc: vscode.TextDocument) {
  await doReview(doc, doc.getText());
}

async function doReview(doc: vscode.TextDocument, code: string) {
  const config = getConfig();
  const language = mapLanguage(doc.languageId, code);

  if (!language) {
    vscode.window.showInformationMessage(`Code Review: Language "${doc.languageId}" is not supported. Supported: Python, PySpark, Scala, SQL, Terraform.`);
    return;
  }

  setStatusReviewing();

  try {
    const result = await reviewCode(code, language, config.serverUrl, config.apiKey || undefined);

    // Store result for refactored code access
    lastReviewResults.set(doc.uri.toString(), result);

    // Store refactored code for code actions
    if (result.refactoredCode) {
      setRefactoredCode(doc.uri.toString(), result.refactoredCode);
    }

    const diagnostics = mapIssuesToDiagnostics(result.issues, doc, config.severityFilter);
    diagnosticCollection.set(doc.uri, diagnostics);

    const issueCount = diagnostics.length;
    if (issueCount === 0) {
      setStatusClean();
      vscode.window.showInformationMessage('Code Review: No issues found!');
    } else {
      setStatusIssues(issueCount, result.issues);
      const criticals = result.issues.filter(i => i.severity === 'critical').length;
      const highs = result.issues.filter(i => i.severity === 'high').length;
      const hasRefactored = result.refactoredCode ? ' (refactored code available)' : '';
      const msg = `Code Review: ${issueCount} issue${issueCount !== 1 ? 's' : ''} found`
        + (criticals ? ` (${criticals} critical)` : '')
        + (highs ? ` (${highs} high)` : '')
        + hasRefactored;
      vscode.window.showWarningMessage(msg, 'Show Refactored Code').then(selection => {
        if (selection === 'Show Refactored Code') {
          vscode.commands.executeCommand('codereview.showRefactoredCode');
        }
      });
    }
  } catch (err: any) {
    setStatusIdle();
    vscode.window.showErrorMessage(`Code Review: ${err.message}`);
  }
}

// ── Refactored code commands ──

async function showRefactoredCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const result = lastReviewResults.get(editor.document.uri.toString());
  if (!result?.refactoredCode) {
    vscode.window.showInformationMessage('Code Review: No refactored code available. Run a review first.');
    return;
  }

  // Open refactored code in a new editor as a diff view
  const originalUri = editor.document.uri;
  const refactoredDoc = await vscode.workspace.openTextDocument({
    content: result.refactoredCode,
    language: editor.document.languageId,
  });

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalUri,
    refactoredDoc.uri,
    `${editor.document.fileName} ↔ Refactored (AI Code Review)`,
  );
}

async function applyRefactoredCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const result = lastReviewResults.get(editor.document.uri.toString());
  if (!result?.refactoredCode) {
    vscode.window.showInformationMessage('Code Review: No refactored code available. Run a review first.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    'This will replace the entire file content with the AI-refactored code. Continue?',
    { modal: true },
    'Apply Refactored Code',
  );

  if (confirm !== 'Apply Refactored Code') {
    return;
  }

  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length),
  );

  const uriStr = editor.document.uri.toString();

  // Mark to skip auto-review on next save
  skipNextAutoReview.add(uriStr);

  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, result.refactoredCode!);
  });

  // Clear all diagnostics and cached data for this document
  diagnosticCollection.delete(editor.document.uri);
  lastReviewResults.delete(uriStr);
  clearRefactoredCode(uriStr);
  clearSuggestions();
  setStatusIdle();

  vscode.window.showInformationMessage('Code Review: Refactored code applied successfully! Run review again to verify.');
}

// ── Status bar helpers ──

function setStatusIdle() {
  statusBarItem.text = '$(shield) Code Review';
  statusBarItem.tooltip = 'Click to review current file (Ctrl+Shift+R)';
  statusBarItem.backgroundColor = undefined;
}

function setStatusReviewing() {
  statusBarItem.text = '$(sync~spin) Reviewing...';
  statusBarItem.tooltip = 'AI Code Review is analyzing your code';
  statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
}

function setStatusClean() {
  statusBarItem.text = '$(shield-check) Code Review: 0 issues';
  statusBarItem.tooltip = 'No issues detected';
  statusBarItem.backgroundColor = undefined;
}

function setStatusIssues(count: number, issues: { severity: string }[]) {
  const hasCritical = issues.some(i => i.severity === 'critical');
  statusBarItem.text = `$(shield-x) Code Review: ${count} issue${count !== 1 ? 's' : ''}`;
  statusBarItem.tooltip = 'Click to review again';
  statusBarItem.backgroundColor = hasCritical
    ? new vscode.ThemeColor('statusBarItem.errorBackground')
    : new vscode.ThemeColor('statusBarItem.warningBackground');
}

export function deactivate() {
  diagnosticCollection?.dispose();
  statusBarItem?.dispose();
  saveListener?.dispose();
}
