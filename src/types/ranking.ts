// ============================================================
// Ranking Result Schema — Structured output from Decision Agent
// Validates LLM output for product ranking/recommendation
// ============================================================

import { z } from 'zod';

/**
 * A single reason why the recommended product was selected.
 */
export const RankingReasonSchema = z.object({
  /** Short factor label (e.g., "Within budget", "Fast delivery") */
  factor: z.string().min(1),
  /** Detailed explanation */
  explanation: z.string().min(1),
  /** Whether this factor was satisfied */
  satisfied: z.boolean(),
});
export type RankingReason = z.infer<typeof RankingReasonSchema>;

/**
 * An alternative product and why it ranked lower.
 */
export const AlternativeProductSchema = z.object({
  /** Product ID from the catalog — MUST exist in candidate list */
  productId: z.string().min(1),
  /** Why this product ranked lower than the top pick */
  reason: z.string().min(1),
  /** Overall match score (0–100) */
  score: z.number().min(0).max(100),
});
export type AlternativeProduct = z.infer<typeof AlternativeProductSchema>;

/**
 * Full ranking result from the Decision Agent.
 */
export const RankingResultSchema = z.object({
  /** Product ID of the top recommendation — MUST exist in candidate list */
  selectedProductId: z.string().min(1),

  /** Overall match score for the selected product (0–100) */
  confidenceScore: z.number().min(0).max(100),

  /** Structured reasons for the recommendation */
  reasons: z.array(RankingReasonSchema).min(1),

  /** Alternative products with explanations */
  alternatives: z.array(AlternativeProductSchema).default([]),

  /** One-sentence summary of the recommendation */
  summary: z.string().min(1),
});
export type RankingResult = z.infer<typeof RankingResultSchema>;
