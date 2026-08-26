// ============================================================
// Ranking Result Schema — Structured output from Decision Agent
// Validates LLM output for product ranking/recommendation
// ============================================================
// Also contains MerchantRecommendationsSchema (Phase 8)
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

// ── Merchant Recommendation Types (Phase 8) ───────────────────

export const RecommendationTypeSchema = z.enum([
  'CROSS_SELL',
  'UPSELL',
  'BUNDLE',
  'CONTEXTUAL_OFFER',
]);
export type RecommendationType = z.infer<typeof RecommendationTypeSchema>;

/**
 * A single optional merchant recommendation.
 * isOptional is always true — the buyer is never auto-charged.
 */
export const MerchantRecommendationItemSchema = z.object({
  /** Product ID from the catalog — MUST exist in candidate list */
  productId: z.string().min(1),
  /** Short product name (from catalog) */
  productName: z.string().min(1),
  /** Price from catalog — never modified by LLM */
  price: z.number().positive(),
  /** Type of recommendation */
  type: RecommendationTypeSchema,
  /** One-sentence reason for this recommendation */
  reason: z.string().min(1),
  /** Always true — buyer must explicitly opt in */
  isOptional: z.literal(true),
});
export type MerchantRecommendationItem = z.infer<typeof MerchantRecommendationItemSchema>;

/**
 * Full set of optional merchant recommendations returned by the Merchant Agent.
 * All lists may be empty. No item is ever auto-added to a payment.
 */
export const MerchantRecommendationsSchema = z.object({
  /** Products from other/same category that pair well */
  crossSells: z.array(MerchantRecommendationItemSchema).max(3).default([]),
  /** Higher-priced alternatives with more features */
  upsells: z.array(MerchantRecommendationItemSchema).max(2).default([]),
  /** Products that create a logical bundle */
  bundles: z.array(MerchantRecommendationItemSchema).max(3).default([]),
  /** Single contextual offer, if applicable */
  contextualOffer: MerchantRecommendationItemSchema.nullable().default(null),
  /** Agent summary for why these recommendations were made */
  summary: z.string().default(''),
});
export type MerchantRecommendations = z.infer<typeof MerchantRecommendationsSchema>;
