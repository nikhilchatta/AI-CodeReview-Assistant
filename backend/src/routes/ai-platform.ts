import { Router, type Request, type Response } from 'express';

// In-memory token cache
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

interface AIPlatformConfig {
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

function getConfig(): AIPlatformConfig {
  return {
    baseUrl: process.env.AI_PLATFORM_BASE_URL || '',
    tokenUrl: process.env.AI_PLATFORM_TOKEN_URL || '',
    clientId: process.env.AI_PLATFORM_CLIENT_ID || '',
    clientSecret: process.env.AI_PLATFORM_CLIENT_SECRET || '',
  };
}

function getRuntimeConfig(req: Request): AIPlatformConfig | null {
  const baseUrl = req.headers['x-ai-platform-base-url'] as string;
  const tokenUrl = req.headers['x-ai-platform-token-url'] as string;
  const clientId = req.headers['x-ai-platform-client-id'] as string;
  const clientSecret = req.headers['x-ai-platform-client-secret'] as string;
  if (baseUrl && tokenUrl && clientId && clientSecret) {
    return { baseUrl: baseUrl.replace(/\/+$/, ''), tokenUrl, clientId, clientSecret };
  }
  return null;
}

async function getOAuthToken(config: AIPlatformConfig): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token request failed (${res.status}): ${text}`);
  }

  const data = await res.json() as any;
  const accessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;

  cachedToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken;
}

export async function callAIPlatform(
  config: AIPlatformConfig,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  maxTokens: number = 8192,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; model: string } }> {
  const token = await getOAuthToken(config);

  const body: any = {
    model,
    max_tokens: maxTokens,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
  };

  const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI Platform API error (${res.status}): ${text}`);
  }

  const data = await res.json() as any;
  const choice = data.choices?.[0];
  const text = choice?.message?.content || '';

  return {
    text,
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      model: data.model || model,
    },
  };
}

export function getAIPlatformConfig(req: Request): AIPlatformConfig | null {
  const runtime = getRuntimeConfig(req);
  if (runtime) return runtime;

  const env = getConfig();
  if (env.baseUrl && env.tokenUrl && env.clientId && env.clientSecret) return env;

  return null;
}

export function createAIPlatformRouter(): Router {
  const router = Router();

  // Check if AI Platform is configured
  router.get('/ai-platform/config', (_req: Request, res: Response) => {
    const config = getConfig();
    const configured = !!(config.baseUrl && config.tokenUrl && config.clientId && config.clientSecret);
    res.json({ configured, baseUrl: config.baseUrl || undefined });
  });

  // List available models
  router.get('/ai-platform/models', async (req: Request, res: Response) => {
    const config = getAIPlatformConfig(req);
    if (!config) {
      res.status(400).json({ error: 'AI Platform not configured' });
      return;
    }

    try {
      const token = await getOAuthToken(config);
      const response = await fetch(`${config.baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        res.status(response.status).json({ error: `Failed to list models: ${response.status}`, details: text });
        return;
      }

      const data = await response.json() as any;
      const models = (data.data || data.models || []).map((m: any) => ({
        id: m.id || m.name,
        name: m.id || m.name,
        ownedBy: m.owned_by || '',
      }));

      res.json({ models });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to list models: ${err.message}` });
    }
  });

  // Validate OAuth credentials
  router.post('/ai-platform/validate', async (req: Request, res: Response) => {
    const { baseUrl, tokenUrl, clientId, clientSecret } = req.body as AIPlatformConfig;
    if (!baseUrl || !tokenUrl || !clientId || !clientSecret) {
      res.json({ valid: false, error: 'All fields are required' });
      return;
    }

    try {
      const config = { baseUrl: baseUrl.replace(/\/+$/, ''), tokenUrl, clientId, clientSecret };
      const token = await getOAuthToken(config);

      // Try listing models to verify the token works
      const modelsRes = await fetch(`${config.baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!modelsRes.ok) {
        res.json({ valid: false, error: `Connected but models endpoint returned ${modelsRes.status}` });
        return;
      }

      const data = await modelsRes.json() as any;
      const models = (data.data || data.models || []).map((m: any) => ({
        id: m.id || m.name,
        name: m.id || m.name,
      }));

      res.json({ valid: true, models });
    } catch (err: any) {
      res.json({ valid: false, error: err.message });
    }
  });

  return router;
}
