import type { CodeIssue, CodeReviewResult, ValidationRule } from '../types';
import { getEnabledRules } from './validation-rules';
import { generateFixedCode } from './code-fixer';
import { analyzeCodeWithClaudeAI, isSimilarIssue } from '../services/claude-ai-validator';
import type { AICodeIssue } from '../types';

interface ExternalValidationResult {
  success: boolean;
  apiUnavailable: boolean;
  errorMessage?: string;
  refactoredCode?: string;
}

const applyConfigurationRules = (
  code: string,
  pipelineType: string,
  issues: CodeIssue[],
  performanceScore: { value: number },
  securityScore: { value: number },
  codeQualityScore: { value: number },
  maintainabilityScore: { value: number }
): void => {
  const lines = code.split('\n');
  const languageMap: Record<string, 'pyspark' | 'python' | 'scala' | 'sql' | 'terraform'> = {
    'pyspark': 'pyspark', 'python': 'python', 'scala': 'scala', 'sql': 'sql', 'terraform': 'terraform', 'tf': 'terraform',
  };
  const language = languageMap[pipelineType.toLowerCase()] || 'python';
  const languageRules = getEnabledRules(language);
  const securityRules = getEnabledRules('security' as any);
  const commonRules = getEnabledRules('common' as any);
  const allRules = [...languageRules, ...securityRules, ...commonRules];

  allRules.forEach((rule: ValidationRule) => {
    let ruleMatched = false;
    let matchedLineNumber: number | undefined;

    if (rule.pattern) {
      const regex = typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'gi')
        : rule.pattern;
      if (regex.test(code)) {
        ruleMatched = true;
        const lineIndex = lines.findIndex(line => {
          const lineRegex = typeof rule.pattern === 'string'
            ? new RegExp(rule.pattern as string, 'gi')
            : new RegExp(rule.pattern!.source, rule.pattern!.flags);
          return lineRegex.test(line);
        });
        if (lineIndex !== -1) matchedLineNumber = lineIndex + 1;
      }
    }
    if (!ruleMatched && rule.checkFunction) {
      ruleMatched = rule.checkFunction(code);
    }
    if (ruleMatched) {
      issues.push({
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
        suggestion: rule.suggestion,
        lineNumber: matchedLineNumber,
        validationSource: 'internal',
      });
      const scoreDeduction = { critical: 25, high: 15, medium: 10, low: 5, info: 2 }[rule.severity];
      switch (rule.category) {
        case 'performance': performanceScore.value -= scoreDeduction; break;
        case 'security': securityScore.value -= scoreDeduction; break;
        case 'code-structure': case 'best-practice': case 'logging': codeQualityScore.value -= scoreDeduction; break;
        case 'maintainability': case 'data-quality': case 'exception-handling': maintainabilityScore.value -= scoreDeduction; break;
      }
    }
  });
};

const applyExternalValidation = async (
  code: string,
  pipelineType: string,
  internalIssues: CodeIssue[],
  strengths: string[],
  recommendations: string[]
): Promise<ExternalValidationResult> => {
  try {
    const aiResult = await analyzeCodeWithClaudeAI(code, pipelineType);
    if (aiResult.apiUnavailable) {
      recommendations.push('External AI analysis was skipped because the Claude API is not available. Configure ANTHROPIC_API_KEY for enhanced code review.');
      return { success: false, apiUnavailable: true, errorMessage: aiResult.error };
    }
    if (aiResult.error) {
      recommendations.push(`External AI analysis encountered an error: ${aiResult.error}`);
      return { success: false, apiUnavailable: false, errorMessage: aiResult.error };
    }

    aiResult.issues.forEach((aiIssue: AICodeIssue) => {
      const similarInternalIssue = internalIssues.find(internalIssue =>
        isSimilarIssue(
          { message: internalIssue.message, lineNumber: internalIssue.lineNumber, category: internalIssue.category },
          { message: aiIssue.message, lineNumber: aiIssue.lineNumber, category: aiIssue.category }
        )
      );
      if (similarInternalIssue) {
        similarInternalIssue.validationSource = 'both';
        if (aiIssue.reasoning) {
          similarInternalIssue.suggestion = similarInternalIssue.suggestion + `\n\nAI Analysis: ${aiIssue.reasoning}`;
        }
      } else {
        internalIssues.push({
          severity: aiIssue.severity,
          category: aiIssue.category,
          message: aiIssue.message,
          lineNumber: aiIssue.lineNumber,
          suggestion: aiIssue.suggestion + (aiIssue.reasoning ? `\n\nReasoning: ${aiIssue.reasoning}` : ''),
          codeSnippet: aiIssue.codeSnippet,
          validationSource: 'external',
        });
      }
    });

    aiResult.strengths.forEach(strength => { if (!strengths.includes(strength)) strengths.push(strength); });
    aiResult.recommendations.forEach(rec => { if (!recommendations.includes(rec)) recommendations.push(rec); });

    return { success: true, apiUnavailable: false, refactoredCode: aiResult.refactoredCode };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    recommendations.push(`External AI analysis failed: ${errorMessage}. Review results are based on internal pattern matching only.`);
    return { success: false, apiUnavailable: errorMessage.includes('API') || errorMessage.includes('fetch'), errorMessage };
  }
};

export async function analyzeCodeForReview(code: string, pipelineType: string): Promise<CodeReviewResult> {
  const issues: CodeIssue[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  const performanceScoreObj = { value: 100 };
  const securityScoreObj = { value: 100 };
  const codeQualityScoreObj = { value: 100 };
  const maintainabilityScoreObj = { value: 100 };

  applyConfigurationRules(code, pipelineType, issues, performanceScoreObj, securityScoreObj, codeQualityScoreObj, maintainabilityScoreObj);

  const externalValidationResult = await applyExternalValidation(code, pipelineType, issues, strengths, recommendations);

  let performanceScore = performanceScoreObj.value;
  let securityScore = securityScoreObj.value;
  let codeQualityScore = codeQualityScoreObj.value;
  let maintainabilityScore = maintainabilityScoreObj.value;

  if (code.includes('.cache()') || code.includes('.persist()')) { strengths.push('Proper DataFrame caching implemented'); performanceScore += 5; }
  if (code.includes('broadcast(') || code.includes('broadcast ')) { strengths.push('Using broadcast hints for join optimization'); performanceScore += 5; }
  if (code.includes('try') || code.includes('Try {') || code.includes('try:')) { strengths.push('Error handling implemented'); codeQualityScore += 5; }
  if (code.includes('coalesce(') || code.includes('repartition(')) { strengths.push('Partition management for output optimization'); performanceScore += 3; }
  if (code.includes('StructType') || code.includes('schema =')) { strengths.push('Explicit schema definition used'); performanceScore += 5; }

  if (performanceScore < 85) recommendations.push('Review and optimize query performance patterns');
  if (!code.includes('.cache()') && (code.match(/df\./g) || []).length > 5) recommendations.push('Consider caching DataFrames that are reused multiple times');
  if (code.includes('join') && !code.includes('broadcast')) recommendations.push('Consider broadcast hints for small lookup tables in joins');
  if (!code.includes('partitionBy') && code.includes('.write')) recommendations.push('Consider partitioning output data for better query performance');
  if (issues.length > 0) recommendations.push('Address high-severity issues first for maximum impact');
  recommendations.push('Add comprehensive unit tests for transformation logic');
  recommendations.push('Implement logging for pipeline monitoring and debugging');

  const overallScore = Math.round(
    (performanceScore * 0.35 + securityScore * 0.25 + codeQualityScore * 0.2 + maintainabilityScore * 0.2)
  );

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const totalEffort = criticalCount * 4 + highCount * 2 + issues.length;
  const effortEstimate = totalEffort <= 4 ? '1-2 hours' : totalEffort <= 8 ? '2-4 hours' : totalEffort <= 15 ? '4-8 hours' : '1-2 days';

  const languageDisplayNames: Record<string, string> = {
    'pyspark': 'PySpark', 'python': 'Python', 'scala': 'Scala', 'sql': 'SQL', 'terraform': 'Terraform', 'tf': 'Terraform',
  };
  const displayLanguage = languageDisplayNames[pipelineType.toLowerCase()] || pipelineType;

  const summaryParts = [`Analyzed ${displayLanguage} code. Overall score: ${overallScore}/100`];
  if (issues.length > 0) {
    summaryParts.push(`Found ${issues.length} issue(s): ${criticalCount} critical, ${highCount} high`);
  }

  let fixedCode: string | undefined;
  if (issues.length > 0) {
    if (externalValidationResult.refactoredCode) {
      fixedCode = generateFixedCode(externalValidationResult.refactoredCode, pipelineType);
    } else {
      fixedCode = generateFixedCode(code, pipelineType);
    }
  }

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    codeQuality: Math.max(0, Math.min(100, codeQualityScore)),
    performance: Math.max(0, Math.min(100, performanceScore)),
    security: Math.max(0, Math.min(100, securityScore)),
    maintainability: Math.max(0, Math.min(100, maintainabilityScore)),
    issues,
    strengths: strengths.length > 0 ? strengths : ['Code structure is clean'],
    recommendations,
    estimatedRefactoringEffort: effortEstimate,
    summary: summaryParts.join('. '),
    fixedCode: fixedCode && fixedCode !== code ? fixedCode : undefined,
    originalCode: code,
    aiApiUnavailable: externalValidationResult.apiUnavailable,
    aiApiError: externalValidationResult.errorMessage,
  };
}
