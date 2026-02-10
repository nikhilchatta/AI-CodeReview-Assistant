import type { DiffLine } from '../types';

export function computeDiff(original: string, refactored: string): DiffLine[] {
  const origLines = original.split('\n');
  const refLines = refactored.split('\n');
  const result: DiffLine[] = [];

  const m = origLines.length;
  const n = refLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === refLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diffItems: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === refLines[j - 1]) {
      diffItems.push({ type: 'unchanged', content: origLines[i - 1], lineNumber: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffItems.push({ type: 'added', content: refLines[j - 1], lineNumber: j });
      j--;
    } else {
      diffItems.push({ type: 'removed', content: origLines[i - 1], lineNumber: i });
      i--;
    }
  }

  diffItems.reverse();

  let addedLineNum = 0;
  for (const item of diffItems) {
    if (item.type !== 'removed') {
      addedLineNum++;
      item.lineNumber = addedLineNum;
    }
    result.push(item);
  }

  return result;
}
