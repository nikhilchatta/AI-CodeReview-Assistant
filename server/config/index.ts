export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
}

export function getPort(): number {
  return parseInt(process.env.PORT || '5001', 10);
}
