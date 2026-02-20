/**
 * Token Pricing Lookup
 *
 * Per-model pricing in USD per 1M tokens.
 * Rates sourced from Anthropic and OpenAI public pricing pages.
 * Add new models or override via CUSTOM_PRICING_JSON env var.
 */

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  // ── Anthropic Claude ──
  'claude-opus-4-20250514':        { inputPerMillion: 15,   outputPerMillion: 75 },
  'claude-sonnet-4-20250514':      { inputPerMillion: 3,    outputPerMillion: 15 },
  'claude-haiku-4-20250514':       { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  // Aliases / shorthand
  'claude-opus-4':                 { inputPerMillion: 15,   outputPerMillion: 75 },
  'claude-sonnet-4':               { inputPerMillion: 3,    outputPerMillion: 15 },
  'claude-haiku-4':                { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  // Older Claude 3.5 models
  'claude-3-5-sonnet-20241022':    { inputPerMillion: 3,    outputPerMillion: 15 },
  'claude-3-5-haiku-20241022':     { inputPerMillion: 0.80, outputPerMillion: 4 },
  // Claude 3 models
  'claude-3-opus-20240229':        { inputPerMillion: 15,   outputPerMillion: 75 },
  'claude-3-sonnet-20240229':      { inputPerMillion: 3,    outputPerMillion: 15 },
  'claude-3-haiku-20240307':       { inputPerMillion: 0.25, outputPerMillion: 1.25 },

  // ── OpenAI (for AI Platform integration) ──
  'gpt-4':                         { inputPerMillion: 30,   outputPerMillion: 60 },
  'gpt-4-turbo':                   { inputPerMillion: 10,   outputPerMillion: 30 },
  'gpt-4o':                        { inputPerMillion: 2.50, outputPerMillion: 10 },
  'gpt-4o-mini':                   { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'gpt-3.5-turbo':                 { inputPerMillion: 0.50, outputPerMillion: 1.50 },
};

// Load custom pricing overrides from env
function loadCustomPricing(): void {
  const raw = process.env.CUSTOM_PRICING_JSON;
  if (!raw) return;
  try {
    const overrides = JSON.parse(raw) as Record<string, ModelPricing>;
    Object.assign(PRICING, overrides);
    console.log(`[PRICING] Loaded ${Object.keys(overrides).length} custom pricing override(s)`);
  } catch {
    console.warn('[PRICING] Failed to parse CUSTOM_PRICING_JSON');
  }
}
loadCustomPricing();

/**
 * Calculate cost in USD for a given model + token counts.
 * Returns 0 if the model is unknown.
 */
export function calculateCost(
  model: string | undefined | null,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!model) return 0;

  // Try exact match first, then prefix match for versioned model IDs
  let pricing = PRICING[model];
  if (!pricing) {
    const key = Object.keys(PRICING).find((k) => model.startsWith(k));
    if (key) pricing = PRICING[key];
  }

  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  // Round to 6 decimal places (sub-cent precision)
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

/**
 * Return the full pricing table (for frontend display / API).
 */
export function getPricingTable(): Record<string, ModelPricing> {
  return { ...PRICING };
}
