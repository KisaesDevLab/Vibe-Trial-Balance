import { db } from '../db';

interface LogAiUsageOptions {
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  userId?: number | null;
  clientId?: number | null;
}

interface ModelPricing {
  input: number;  // $ per million tokens
  output: number;
}

export function logAiUsage(opts: LogAiUsageOptions): void {
  // Fire-and-forget — never throws, never blocks a response
  void (async () => {
    try {
      const pricingRow = await db('settings').where({ key: 'ai_model_pricing' }).first('value');
      const pricing: Record<string, ModelPricing> = pricingRow?.value
        ? JSON.parse(pricingRow.value as string)
        : {};
      const mp: ModelPricing = pricing[opts.model] ?? { input: 0, output: 0 };
      const estimatedCost =
        (opts.inputTokens / 1_000_000) * mp.input +
        (opts.outputTokens / 1_000_000) * mp.output;

      await db('ai_usage_log').insert({
        user_id:           opts.userId   ?? null,
        client_id:         opts.clientId ?? null,
        endpoint:          opts.endpoint,
        model:             opts.model,
        input_tokens:      opts.inputTokens,
        output_tokens:     opts.outputTokens,
        estimated_cost_usd: estimatedCost > 0 ? estimatedCost : null,
      });
    } catch (err: unknown) {
      // Usage logging must never break the main request — log at debug level only
      console.debug('[aiUsage] Failed to log:', err instanceof Error ? err.message : String(err));
    }
  })();
}
