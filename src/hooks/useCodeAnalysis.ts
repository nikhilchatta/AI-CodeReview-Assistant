import { useState, useCallback, useRef } from 'react';
import type { CodeReviewResult, SupportedLanguage } from '../types';
import { analyzeCodeForReview } from '../engine/analyzer';
import { detectLanguageFromCode } from '../engine/language-detector';

const STEPS = ['Analyzing Code Structure', 'Checking Performance', 'Security Review', 'Best Practices', 'Generating Report'];

interface UseCodeAnalysisReturn {
  result: CodeReviewResult | null;
  loading: boolean;
  activeStep: number;
  steps: string[];
  analyze: (code: string, language: SupportedLanguage | 'auto') => Promise<void>;
  reset: () => void;
}

export function useCodeAnalysis(
  onStatusChange?: (status: 'idle' | 'analyzing' | 'done' | 'error') => void,
  onProgressChange?: (progress: number) => void,
): UseCodeAnalysisReturn {
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const analyze = useCallback(async (code: string, language: SupportedLanguage | 'auto') => {
    setLoading(true);
    setResult(null);
    setActiveStep(0);
    onStatusChange?.('analyzing');
    onProgressChange?.(0);

    intervalRef.current = setInterval(() => {
      setActiveStep(prev => {
        const next = prev < STEPS.length - 1 ? prev + 1 : prev;
        onProgressChange?.(((next + 1) / STEPS.length) * 100);
        return next;
      });
    }, 600);

    try {
      const detectedLang = language === 'auto' ? detectLanguageFromCode(code) : language;
      const reviewResult = await analyzeCodeForReview(code, detectedLang);
      setResult(reviewResult);
      onStatusChange?.('done');
      onProgressChange?.(100);
    } catch (err) {
      console.error('Analysis failed:', err);
      onStatusChange?.('error');
    } finally {
      clearInterval(intervalRef.current);
      setActiveStep(STEPS.length);
      setLoading(false);
    }
  }, [onStatusChange, onProgressChange]);

  const reset = useCallback(() => {
    setResult(null);
    setLoading(false);
    setActiveStep(0);
    onStatusChange?.('idle');
    onProgressChange?.(0);
  }, [onStatusChange, onProgressChange]);

  return { result, loading, activeStep, steps: STEPS, analyze, reset };
}
