import { useState, useCallback } from 'react';
import { validationStandards } from '../engine/validation-rules';
import type { ValidationRule, ValidationStandards } from '../types';

const STORAGE_KEY = 'custom-rules';

type GroupKey = keyof ValidationStandards;

interface SerializedRule {
  id: string;
  name: string;
  enabled: boolean;
  patternSource?: string;
  patternFlags?: string;
  severity: ValidationRule['severity'];
  category: ValidationRule['category'];
  message: string;
  suggestion: string;
  languages: ValidationRule['languages'];
}

function serializeRules(standards: ValidationStandards): Record<string, SerializedRule[]> {
  const result: Record<string, SerializedRule[]> = {};
  for (const [key, rules] of Object.entries(standards)) {
    result[key] = rules.map((r: ValidationRule) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      patternSource: r.pattern instanceof RegExp ? r.pattern.source : typeof r.pattern === 'string' ? r.pattern : undefined,
      patternFlags: r.pattern instanceof RegExp ? r.pattern.flags : undefined,
      severity: r.severity,
      category: r.category,
      message: r.message,
      suggestion: r.suggestion,
      languages: r.languages,
    }));
  }
  return result;
}

function deserializeRules(data: Record<string, SerializedRule[]>): ValidationStandards {
  const result: Record<string, ValidationRule[]> = {};
  for (const [key, rules] of Object.entries(data)) {
    result[key] = rules.map(r => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      pattern: r.patternSource ? new RegExp(r.patternSource, r.patternFlags || '') : undefined,
      severity: r.severity,
      category: r.category,
      message: r.message,
      suggestion: r.suggestion,
      languages: r.languages,
    }));
  }
  return result as unknown as ValidationStandards;
}

function loadRules(): ValidationStandards {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return deserializeRules(JSON.parse(stored));
  } catch { /* ignore */ }
  return validationStandards;
}

function saveRules(rules: ValidationStandards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeRules(rules)));
}

export function useRules() {
  const [rules, setRules] = useState<ValidationStandards>(loadRules);

  const persist = useCallback((next: ValidationStandards) => {
    setRules(next);
    saveRules(next);
  }, []);

  const addRule = useCallback((group: GroupKey, rule: ValidationRule) => {
    setRules(prev => {
      const next = { ...prev, [group]: [...prev[group], rule] };
      saveRules(next);
      return next;
    });
  }, []);

  const updateRule = useCallback((group: GroupKey, ruleId: string, updates: Partial<ValidationRule>) => {
    setRules(prev => {
      const next = {
        ...prev,
        [group]: prev[group].map(r => r.id === ruleId ? { ...r, ...updates } : r),
      };
      saveRules(next);
      return next;
    });
  }, []);

  const deleteRule = useCallback((group: GroupKey, ruleId: string) => {
    setRules(prev => {
      const next = { ...prev, [group]: prev[group].filter(r => r.id !== ruleId) };
      saveRules(next);
      return next;
    });
  }, []);

  const toggleRule = useCallback((group: GroupKey, ruleId: string) => {
    setRules(prev => {
      const next = {
        ...prev,
        [group]: prev[group].map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r),
      };
      saveRules(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRules(validationStandards);
  }, []);

  return { rules, addRule, updateRule, deleteRule, toggleRule, resetToDefaults };
}
