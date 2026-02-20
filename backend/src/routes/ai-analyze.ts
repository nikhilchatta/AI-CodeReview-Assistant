import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getAIPlatformConfig, callAIPlatform } from './ai-platform.js';
import { runPatternRules, mergeIssues } from '../engine/pattern-rules.js';

interface AIAnalysisResponse {
  issues: any[];
  strengths: string[];
  recommendations: string[];
  refactoredCode?: string;
}

function getClaudeClient(req: any, defaultClient: Anthropic | null): Anthropic | null {
  const runtimeKey = (req.headers['x-anthropic-api-key'] as string)?.trim();
  if (runtimeKey && runtimeKey.startsWith('sk-ant-')) {
    return new Anthropic({ apiKey: runtimeKey });
  }
  return defaultClient;
}

export function createAIAnalyzeRouter(): Router {
  const router = Router();

  const rawApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  console.log('[AI-ANALYZE] Checking for API key...');
  console.log(`[AI-ANALYZE] ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`[AI-ANALYZE] CLAUDE_API_KEY present: ${!!process.env.CLAUDE_API_KEY}`);

  if (!rawApiKey) {
    console.warn('[AI-ANALYZE] ANTHROPIC_API_KEY not found - AI analysis endpoint will return errors');
  } else {
    console.log(`[AI-ANALYZE] API key found: ${rawApiKey.substring(0, 15)}...${rawApiKey.slice(-6)}`);
  }

  const apiKey = rawApiKey?.trim();
  let defaultClaude: Anthropic | null = null;

  if (apiKey) {
    if (!apiKey.startsWith('sk-ant-')) {
      console.error('[AI-ANALYZE] Invalid ANTHROPIC_API_KEY format - must start with "sk-ant-"');
    } else {
      console.log('[AI-ANALYZE] Initializing Anthropic SDK...');
      defaultClaude = new Anthropic({ apiKey });
      console.log('[AI-ANALYZE] Anthropic SDK initialized successfully');
    }
  }

  // Check AI auth configuration
  router.get('/ai/config', (_req, res) => {
    res.json({
      serverKeyConfigured: !!defaultClaude,
      authModes: ['api-key', ...(defaultClaude ? ['server-key'] : [])],
    });
  });

  // Validate a user-provided API key
  router.post('/ai/validate-key', async (req, res) => {
    const { apiKey: userKey } = req.body as { apiKey: string };
    if (!userKey?.trim()) {
      res.status(400).json({ valid: false, error: 'API key is required' });
      return;
    }
    const trimmed = userKey.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      res.json({ valid: false, error: 'Invalid format. Key must start with "sk-ant-"' });
      return;
    }
    try {
      const testClient = new Anthropic({ apiKey: trimmed });
      await testClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      res.json({ valid: true });
    } catch (err: any) {
      res.json({ valid: false, error: err.status === 401 ? 'Authentication failed. Check your API key.' : err.message });
    }
  });

  router.post('/analyze-code', async (req, res) => {
    console.log('[AI-ANALYZE] Received analyze-code request');

    try {
      const { code, language, prompt } = req.body;

      if (!code) return res.status(400).json({ error: 'code is required' });
      if (!language) return res.status(400).json({ error: 'language is required' });

      const aiProvider = req.headers['x-ai-provider'] as string;
      const aiModel = req.headers['x-ai-model'] as string;
      const analysisPrompt = prompt || buildDefaultPrompt(code, language);

      console.log(`[AI-ANALYZE] Starting analysis for ${language}, ${code.length} chars, provider=${aiProvider || 'claude'}`);

      // ── Step 1: Run pattern-based rules (same engine the UI uses) ──
      const patternIssues = runPatternRules(code, language);
      console.log(`[AI-ANALYZE] Pattern rules found ${patternIssues.length} issues`);

      // ── Step 2: Run AI analysis ──
      let aiResult: AIAnalysisResponse = { issues: [], strengths: [], recommendations: [] };
      let tokenUsage: any = undefined;

      // AI Platform path (OpenAI-compatible)
      if (aiProvider === 'ai-platform') {
        const platformConfig = getAIPlatformConfig(req);
        if (!platformConfig) {
          return res.status(503).json({ error: 'AI Platform not configured.', apiUnavailable: true });
        }

        const result = await callAIPlatform(
          platformConfig,
          aiModel || 'gpt-4',
          [{ role: 'user', content: analysisPrompt }],
          undefined,
          8192,
        );

        aiResult = parseClaudeResponse(result.text);
        tokenUsage = result.usage;
      } else {
        // Claude SDK path (default)
        const claude = getClaudeClient(req, defaultClaude);

        if (!claude) {
          return res.status(503).json({
            error: 'Claude AI API is not configured. Provide an API key or set ANTHROPIC_API_KEY environment variable.',
            apiUnavailable: true,
          });
        }

        const response = await claude.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [{ role: 'user', content: analysisPrompt }],
        });

        const responseText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');

        aiResult = parseClaudeResponse(responseText);
        tokenUsage = {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          model: response.model,
        };
      }

      // ── Step 3: Merge & deduplicate ──
      const mergedIssues = mergeIssues(patternIssues, aiResult.issues);
      console.log(`[AI-ANALYZE] Analysis completed: ${aiResult.issues.length} AI + ${patternIssues.length} pattern → ${mergedIssues.length} merged issues`);

      res.json({
        issues: mergedIssues,
        strengths: aiResult.strengths,
        recommendations: aiResult.recommendations,
        refactoredCode: aiResult.refactoredCode,
        tokenUsage,
      });
    } catch (error: any) {
      console.error('[AI-ANALYZE] Analysis failed:', error.message);

      if (error.status === 401) {
        return res.status(401).json({ error: 'Claude AI API authentication failed.', apiUnavailable: true });
      }
      if (error.status === 429) {
        return res.status(429).json({ error: 'Claude AI API rate limit exceeded.' });
      }
      if (error.status >= 500) {
        return res.status(503).json({ error: 'Claude AI API is temporarily unavailable.', apiUnavailable: true });
      }

      res.status(500).json({ error: 'AI code analysis failed', details: error.message });
    }
  });

  router.get('/health', (_req, res) => {
    res.json({
      status: defaultClaude ? 'healthy' : 'degraded',
      service: 'ai-code-analyzer',
      claudeConfigured: !!defaultClaude,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

function buildDefaultPrompt(code: string, language: string): string {
  const languageContext: Record<string, string> = {
    'pyspark': 'PySpark code reviewer specializing in big data engineering, Spark optimization, and distributed processing',
    'python': 'Python code reviewer specializing in clean code, performance, and best practices',
    'scala': 'Scala code reviewer specializing in functional programming, type safety, and Spark optimization',
    'sql': 'SQL code reviewer specializing in query optimization, indexing, and database performance',
    'terraform': 'Terraform code reviewer specializing in Infrastructure as Code, cloud security, and best practices',
    'tf': 'Terraform code reviewer specializing in Infrastructure as Code, cloud security, and best practices',
  };

  const context = languageContext[language.toLowerCase()] || 'code reviewer specializing in software engineering best practices';

  const languageDisplayNames: Record<string, string> = {
    'pyspark': 'PySpark', 'python': 'Python', 'scala': 'Scala', 'sql': 'SQL', 'terraform': 'Terraform', 'tf': 'Terraform',
  };

  const displayLanguage = languageDisplayNames[language.toLowerCase()] || language;

  return `You are an expert ${context}.

Analyze the following ${displayLanguage} code and identify:

1. **Performance Issues**: Inefficient operations, bottlenecks, optimization opportunities
2. **Semantic Issues**: Logic errors, incorrect implementations, anti-patterns
3. **Architecture Issues**: Design problems, scalability concerns, maintainability
4. **Security Issues**: Vulnerabilities, misconfigurations, exposed secrets
5. **Context-Aware Problems**: Issues that require understanding the intent and context
6. **Complex Patterns**: Problems that go beyond simple regex pattern matching

CODE TO ANALYZE:
\`\`\`${displayLanguage.toLowerCase()}
${code}
\`\`\`

Return your analysis in the following JSON format:
{
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "Performance" | "Data Flow" | "Architecture" | "Logic" | "Best Practice" | "Security",
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
- Provide actionable, specific suggestions
- Include line numbers when possible
- The refactoredCode field MUST contain the complete refactored code that fixes ALL issues you identified.
- Return ONLY valid JSON, no markdown code blocks or other text`;
}

function parseClaudeResponse(responseText: string): AIAnalysisResponse {
  let jsonText = responseText.trim();

  // Extract JSON from markdown code blocks if present
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  // Find the outermost JSON object
  const jsonStartIndex = jsonText.indexOf('{');
  const jsonEndIndex = jsonText.lastIndexOf('}');

  if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
    jsonText = jsonText.substring(jsonStartIndex, jsonEndIndex + 1);
  }

  // Helper to attempt parsing with various repairs
  const tryParse = (text: string): AIAnalysisResponse | null => {
    try {
      const parsed = JSON.parse(text);
      return {
        issues: parsed.issues || [],
        strengths: parsed.strengths || [],
        recommendations: parsed.recommendations || [],
        refactoredCode: parsed.refactoredCode || undefined,
      };
    } catch {
      return null;
    }
  };

  // First attempt: direct parse
  let result = tryParse(jsonText);
  if (result) return result;

  // Second attempt: fix trailing commas and control characters
  let repaired = jsonText
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/[\x00-\x1f]/g, m =>
      m === '\n' ? '\\n' : m === '\r' ? '\\r' : m === '\t' ? '\\t' : '',
    );
  result = tryParse(repaired);
  if (result) return result;

  // Third attempt: fix unescaped quotes in string values
  repaired = repaired.replace(
    /"([^"\\]*(?:\\.[^"\\]*)*)"/g,
    (match) => {
      const inner = match.slice(1, -1);
      const fixed = inner.replace(/(?<!\\)"/g, '\\"');
      return `"${fixed}"`;
    }
  );
  result = tryParse(repaired);
  if (result) return result;

  // Fourth attempt: strip refactoredCode field
  const withoutRefactored = repaired.replace(
    /,?\s*"refactoredCode"\s*:\s*"[\s\S]*?"(?=\s*[,}])/g,
    ''
  );
  result = tryParse(withoutRefactored);
  if (result) {
    console.warn('[AI-ANALYZE] JSON parsed after removing refactoredCode field');
    return result;
  }

  // Fifth attempt: extract arrays individually
  const extractArray = (json: string, key: string): string | null => {
    const keyMatch = json.match(new RegExp(`"${key}"\\s*:\\s*\\[`));
    if (!keyMatch || keyMatch.index === undefined) return null;

    const startIdx = keyMatch.index + keyMatch[0].length - 1;
    let depth = 0;
    let endIdx = startIdx;

    for (let i = startIdx; i < json.length; i++) {
      if (json[i] === '[') depth++;
      else if (json[i] === ']') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    return json.substring(startIdx, endIdx + 1);
  };

  const issuesArray = extractArray(repaired, 'issues');
  const strengthsArray = extractArray(repaired, 'strengths');
  const recsArray = extractArray(repaired, 'recommendations');

  if (issuesArray || strengthsArray || recsArray) {
    const partialJson = `{
      "issues": ${issuesArray || '[]'},
      "strengths": ${strengthsArray || '[]'},
      "recommendations": ${recsArray || '[]'}
    }`;
    result = tryParse(partialJson.replace(/,\s*([\]}])/g, '$1'));
    if (result) {
      console.warn('[AI-ANALYZE] Partial JSON recovery succeeded via array extraction');
      return result;
    }
  }

  // Final fallback
  console.error('[AI-ANALYZE] Failed to parse Claude response as JSON. Response length:', jsonText.length);
  return {
    issues: [],
    strengths: [],
    recommendations: ['AI analysis returned non-standard format. Please try again.'],
  };
}
