// ============================================================
// Parsed Intent Schema — Structured output from Discovery Agent
// Validates LLM output for intent parsing
// ============================================================

import { z } from 'zod';

/**
 * Schema for the structured intent parsed by the LLM from natural language.
 * Every field the LLM extracts must conform to this schema.
 */
export const ParsedIntentSchema = z.object({
  category: z.string().min(1),
  maximumPrice: z.number().positive().nullish().transform(v => v ?? undefined),
  minimumPrice: z.number().min(0).nullish().transform(v => v ?? undefined),
  deliveryDeadline: z.number().int().positive().nullish().transform(v => v ?? undefined),
  requiredAttributes: z.array(z.string()).nullish().transform(v => v ?? []),
  preferredAttributes: z.array(z.string()).nullish().transform(v => v ?? []),
  exclusions: z.array(z.string()).nullish().transform(v => v ?? []),
  quantity: z.number().int().positive().nullish().transform(v => v ?? 1),
  minimumRating: z.number().min(0).max(5).nullish().transform(v => v ?? undefined),
  brand: z.string().nullish().transform(v => v ?? undefined),
  ambiguityQuestions: z.array(z.string()).nullish().transform(v => v ?? []),
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

/**
 * Maps a ParsedIntent to CatalogSearchParams for deterministic catalog search.
 */
export function intentToSearchParams(intent: ParsedIntent): {
  category?: string;
  maxPrice?: number;
  minPrice?: number;
  maxDeliveryDays?: number;
  minRating?: number;
  query?: string;
  tags?: string[];
  inStock: boolean;
  limit: number;
  offset: number;
} {
  return {
    category: intent.category !== 'general' ? intent.category : undefined,
    maxPrice: intent.maximumPrice,
    minPrice: intent.minimumPrice,
    maxDeliveryDays: intent.deliveryDeadline,
    minRating: intent.minimumRating,
    query: intent.brand || undefined,
    tags: intent.requiredAttributes.length > 0 ? intent.requiredAttributes : undefined,
    inStock: true,
    limit: 20,
    offset: 0,
  };
}
