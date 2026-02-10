import { useSyncExternalStore } from 'react';

export interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  callCount: number;
  lastModel: string;
}

const INITIAL: TokenStats = { totalInputTokens: 0, totalOutputTokens: 0, callCount: 0, lastModel: '' };

let stats: TokenStats = { ...INITIAL };
let listeners: Set<() => void> = new Set();

function emit() {
  listeners.forEach(fn => fn());
}

export function addTokenUsage(inputTokens: number, outputTokens: number, model: string) {
  stats = {
    totalInputTokens: stats.totalInputTokens + inputTokens,
    totalOutputTokens: stats.totalOutputTokens + outputTokens,
    callCount: stats.callCount + 1,
    lastModel: model,
  };
  emit();
}

export function resetTokenStats() {
  stats = { ...INITIAL };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return stats;
}

export function useTokenStats(): TokenStats {
  return useSyncExternalStore(subscribe, getSnapshot);
}
