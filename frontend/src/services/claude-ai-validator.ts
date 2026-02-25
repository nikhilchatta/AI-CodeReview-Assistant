import type { AICodeIssue, AIAnalysisResult } from '../types';
import { addTokenUsage } from '../hooks/useTokenStats';

export type { AICodeIssue };

export async function analyzeCodeWithClaudeAI(
  code: string,
  pipelineType: string
): Promise<AIAnalysisResult> {
  const startTime = Date.now();

  try {
    return await callClaudeAPI(code, pipelineType);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isApiUnavailable = errorMessage.includes('API error') ||
                             errorMessage.includes('Failed to fetch') ||
                             errorMessage.includes('NetworkError') ||
                             errorMessage.includes('not configured') ||
                             errorMessage.includes('503') ||
                             errorMessage.includes('502') ||
                             errorMessage.includes('500');

    console.error('External AI validation failed:', error);

    return {
      issues: [],
      strengths: [],
      recommendations: [],
      analysisTime: Date.now() - startTime,
      error: isApiUnavailable
        ? 'Claude AI API is not available. Please check that the API key is configured and the service is running.'
        : errorMessage,
      apiUnavailable: isApiUnavailable,
    };
  }
}

async function callClaudeAPI(
  code: string,
  pipelineType: string
): Promise<AIAnalysisResult> {
  const startTime = Date.now();
  const prompt = buildClaudePrompt(code, pipelineType);

  try {
    // Check for custom LLM configuration
    const customLLMConfig = localStorage.getItem('customLLMConfig');
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let aiProvider = 'claude';
    let aiModel = undefined;

    if (customLLMConfig) {
      try {
        const config = JSON.parse(customLLMConfig);
        if (config.enabled && config.baseUrl && config.tokenUrl && config.clientId && config.clientSecret) {
          // Use custom LLM
          headers['x-ai-provider'] = 'ai-platform';
          headers['x-ai-platform-base-url'] = config.baseUrl;
          headers['x-ai-platform-token-url'] = config.tokenUrl;
          headers['x-ai-platform-client-id'] = config.clientId;
          headers['x-ai-platform-client-secret'] = config.clientSecret;
          if (config.model) {
            headers['x-ai-model'] = config.model;
            aiModel = config.model;
          }
          aiProvider = 'custom';
        }
      } catch (e) {
        console.warn('Failed to parse custom LLM config:', e);
      }
    }

    const response = await fetch('/api/analyze-code', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, language: pipelineType, prompt, source: 'application' }),
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = errorData.error || errorData.message || '';
      } catch {
        // not JSON
      }

      if (response.status === 404) {
        throw new Error('Claude AI API endpoint not configured. Please ensure the backend is running.');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Claude AI API authentication failed. Please check your API key configuration.');
      } else if (response.status >= 500) {
        throw new Error(`Claude AI API server error (${response.status}).`);
      } else {
        throw new Error(`API error: ${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ''}`);
      }
    }

    const data = await response.json();

    if (data.tokenUsage) {
      addTokenUsage(data.tokenUsage.inputTokens, data.tokenUsage.outputTokens, data.tokenUsage.model);
    }

    return {
      issues: data.issues || [],
      strengths: data.strengths || [],
      recommendations: data.recommendations || [],
      refactoredCode: data.refactoredCode || undefined,
      analysisTime: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Failed to fetch: Claude AI API endpoint is not reachable.');
    }
    throw error;
  }
}

function buildClaudePrompt(code: string, pipelineType: string): string {
  const languageContext: Record<string, string> = {
    'pyspark': 'PySpark code reviewer specializing in big data engineering, Spark optimization, and distributed processing',
    'python': 'Python code reviewer specializing in clean code, performance, and best practices',
    'scala': 'Scala code reviewer specializing in functional programming, type safety, and Spark optimization',
    'sql': 'SQL code reviewer specializing in query optimization, indexing, and database performance',
    'terraform': 'Terraform code reviewer specializing in Infrastructure as Code, cloud security, and best practices',
  };

  const context = languageContext[pipelineType.toLowerCase()] || 'code reviewer specializing in software engineering best practices';

  const languageDisplayNames: Record<string, string> = {
    'pyspark': 'PySpark', 'python': 'Python', 'scala': 'Scala', 'sql': 'SQL', 'terraform': 'Terraform', 'tf': 'Terraform',
  };

  const displayLanguage = languageDisplayNames[pipelineType.toLowerCase()] || pipelineType;

  return `You are an expert ${context}.

Analyze the following ${displayLanguage} code and identify:

1. **Performance Issues**: Inefficient operations, bottlenecks, optimization opportunities
2. **Semantic Issues**: Logic errors, incorrect implementations, anti-patterns
3. **Architecture Issues**: Design problems, scalability concerns, maintainability
4. **Security Issues**: Vulnerabilities, misconfigurations, exposed secrets
5. **Context-Aware Problems**: Issues that require understanding the intent and context
6. **Complex Patterns**: Problems that go beyond simple regex pattern matching

Language-specific focus areas:
${pipelineType === 'pyspark' ? '- Data flow inefficiencies, caching strategies, partition optimization' : ''}
${pipelineType === 'python' ? '- Code quality, type hints, exception handling, algorithm efficiency' : ''}
${pipelineType === 'terraform' ? '- Resource configuration, security groups, encryption, cost optimization' : ''}
${pipelineType === 'sql' ? '- Query optimization, index usage, join strategies, data quality' : ''}
${pipelineType === 'scala' ? '- Immutability, pattern matching, type safety, functional paradigms' : ''}

CODE TO ANALYZE:
\`\`\`${displayLanguage.toLowerCase()}
${code}
\`\`\`

Return your analysis in the following JSON format:
{
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "Performance" | "Data Flow" | "Architecture" | "Logic" | "Best Practice",
      "message": "Brief description of the issue",
      "lineNumber": 42,
      "suggestion": "How to fix the issue",
      "reasoning": "Why this is an issue and what the impact is"
    }
  ],
  "strengths": ["Things done well in the code"],
  "recommendations": ["Additional suggestions for improvement"],
  "refactoredCode": "The complete refactored version of the code with ALL identified issues fixed."
}

IMPORTANT:
- Focus on complex issues that require semantic understanding
- Don't repeat simple pattern-based issues (like hardcoded values, missing docstrings)
- Provide actionable, specific suggestions
- Include line numbers when possible
- Explain your reasoning clearly
- The refactoredCode field MUST contain the complete refactored code that fixes ALL issues you identified. Apply best practices, fix security vulnerabilities, optimize performance, and improve code structure. Add inline comments (e.g. "// Fixed: ...") to highlight what was changed and why.`;
}

export function isSimilarIssue(
  issue1: { message: string; lineNumber?: number; category: string },
  issue2: { message: string; lineNumber?: number; category: string }
): boolean {
  if (issue1.lineNumber && issue2.lineNumber && issue1.lineNumber === issue2.lineNumber) {
    return true;
  }

  const message1 = issue1.message.toLowerCase();
  const message2 = issue2.message.toLowerCase();

  const keywords = ['collect', 'cache', 'broadcast', 'join', 'schema', 'password', 'credentials',
                   'udf', 'rdd', 'partition', 'count', 'null', 'hardcoded'];

  for (const keyword of keywords) {
    if (message1.includes(keyword) && message2.includes(keyword)) {
      return true;
    }
  }

  if (issue1.category === issue2.category) {
    const longer = message1.length > message2.length ? message1 : message2;
    const shorter = message1.length > message2.length ? message2 : message1;
    if (longer.length === 0) return true;

    // Simple word overlap similarity
    const words1 = new Set(longer.split(/\s+/));
    const words2 = new Set(shorter.split(/\s+/));
    let overlap = 0;
    for (const w of words2) {
      if (words1.has(w)) overlap++;
    }
    const similarity = overlap / Math.max(words1.size, words2.size);
    if (similarity > 0.6) return true;
  }

  return false;
}
