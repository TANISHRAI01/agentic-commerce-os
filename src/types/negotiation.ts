// ============================================================
// Negotiation Protocol Types — Phase 9
// Defines structured schemas for Buyer ↔ Merchant negotiation.
// All values are validated server-side; LLM output is never
// trusted for financial decisions.
// ============================================================

import { z } from 'zod';

// ── Buyer's initial offer sent to Merchant Agent ─────────────

export const BuyerOfferSchema = z.object({
  productId: z.string(),
  maxBudget: z.number().positive(),
  currency: z.string().min(1),
  maxDeliveryDays: z.number().int().positive().optional(),
  keyRequirements: z.array(z.string()),
  message: z.string(),
});
export type BuyerOffer = z.infer<typeof BuyerOfferSchema>;

// ── Merchant Agent's response ─────────────────────────────────

export const MerchantOfferSchema = z.object({
  productId: z.string(),
  offeredPrice: z.number().positive(),   // Price merchant is willing to sell at
  originalPrice: z.number().positive(),  // Catalogue price (for comparison)
  deliveryDays: z.number().int().positive(),
  offerJustification: z.string(),        // Why this price/offer
  canDiscount: z.boolean(),              // Whether merchant can offer further discount
  maxDiscountAmount: z.number().min(0),  // Max further discount available (in rupees)
  message: z.string(),
});
export type MerchantOffer = z.infer<typeof MerchantOfferSchema>;

// ── Buyer counter-offer (Round 2 only) ───────────────────────

export const BuyerCounterSchema = z.object({
  requestedPrice: z.number().positive(),
  justification: z.string(),
  message: z.string(),
});
export type BuyerCounter = z.infer<typeof BuyerCounterSchema>;

// ── Merchant's final response after counter ───────────────────

export const MerchantFinalSchema = z.object({
  finalPrice: z.number().positive(),
  accepted: z.boolean(),   // Whether merchant accepted the buyer's counter
  message: z.string(),
});
export type MerchantFinal = z.infer<typeof MerchantFinalSchema>;

// ── One complete negotiation round ────────────────────────────

export const NegotiationRoundSchema = z.object({
  round: z.number().int().min(1).max(2),
  buyerMessage: z.string(),
  buyerPrice: z.number().positive(),
  merchantMessage: z.string(),
  merchantPrice: z.number().positive(),
  dealReached: z.boolean(),
});
export type NegotiationRound = z.infer<typeof NegotiationRoundSchema>;

// ── Full negotiation result ───────────────────────────────────

export const NegotiationOutcome = z.enum([
  'DEAL',     // Agreement reached — use negotiatedPrice
  'NO_DEAL',  // No agreement — use original product price
  'SKIPPED',  // Merchant has no discount capability — use original price
]);
export type NegotiationOutcome = z.infer<typeof NegotiationOutcome>;

export const NegotiationResultSchema = z.object({
  outcome: NegotiationOutcome,
  originalPrice: z.number().positive(),
  negotiatedPrice: z.number().positive(), // = originalPrice if NO_DEAL or SKIPPED
  savingsAmount: z.number().min(0),        // = 0 if no deal
  savingsPercent: z.number().min(0),       // = 0 if no deal
  rounds: z.array(NegotiationRoundSchema),
  summary: z.string(), // Human-readable summary for UI display
});
export type NegotiationResult = z.infer<typeof NegotiationResultSchema>;
