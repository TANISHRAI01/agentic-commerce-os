// ============================================================
// Negotiation Agent — Phase 9
// Bounded Buyer ↔ Merchant negotiation (max 2 rounds).
//
// SAFETY INVARIANTS:
// 1. Final price is always server-clamped to merchant's DB policy cap
// 2. negotiatedPrice is always <= originalPrice (never a markup)
// 3. If merchant has no discount capability → SKIPPED immediately
// 4. Negotiation failure is non-fatal — shop pipeline uses original price
// ============================================================

import { generateStructuredOutput } from '@/services/llm';
import type { Product, Merchant } from '@/types/schemas';
import type { ParsedIntent } from '@/types/intent';
import {
  BuyerOfferSchema,
  MerchantOfferSchema,
  BuyerCounterSchema,
  MerchantFinalSchema,
  NegotiationResultSchema,
  type BuyerOffer,
  type MerchantOffer,
  type NegotiationRound,
  type NegotiationResult,
} from '@/types/negotiation';
import { z } from 'zod';

const MAX_ROUNDS = 2;

// ── Buyer Negotiation Agent ───────────────────────────────────

async function generateBuyerOffer(
  intent: ParsedIntent,
  product: Product,
): Promise<BuyerOffer> {
  const prompt = `You are a smart AI Buyer Agent negotiating to buy a product on behalf of a customer.

Product: ${product.name}
Listed price: ₹${product.price}
Customer's maximum budget: ₹${intent.maximumPrice ?? 'not specified'}
Customer's delivery requirement: within ${intent.deliveryDeadline ?? product.deliveryDays} days
Key requirements: ${[...intent.requiredAttributes, ...intent.preferredAttributes].join(', ') || 'none specified'}

Generate a structured, polite opening offer to the merchant. If the listed price is already within budget, express interest at the listed price. If it exceeds the budget, request a review of their best price.`;

  return generateStructuredOutput(prompt, 'Generate a buyer negotiation offer.', BuyerOfferSchema);
}

async function generateBuyerCounter(
  merchantOffer: MerchantOffer,
  intent: ParsedIntent,
): Promise<z.infer<typeof BuyerCounterSchema>> {
  const maxBudget = intent.maximumPrice ?? merchantOffer.originalPrice;
  const prompt = `You are an AI Buyer Agent. The merchant has offered ₹${merchantOffer.offeredPrice} for the product (original: ₹${merchantOffer.originalPrice}).
The merchant indicated they CAN offer a discount of up to ₹${merchantOffer.maxDiscountAmount}.
The customer's maximum budget is ₹${maxBudget}.

The merchant's offer is still above the customer's budget. Request the best possible price, being polite and referencing the customer's budget constraint.`;

  return generateStructuredOutput(prompt, 'Generate a buyer counter-offer.', BuyerCounterSchema);
}

// ── Merchant Negotiation Agent ────────────────────────────────

async function generateMerchantOffer(
  product: Product,
  merchant: Merchant,
  buyerOffer: BuyerOffer,
  maxDiscountPct: number,
): Promise<MerchantOffer> {
  const maxDiscountAmount = Math.floor(product.price * (maxDiscountPct / 100));
  const minimumAcceptablePrice = product.price - maxDiscountAmount;

  const prompt = `You are an AI Merchant Agent representing ${merchant.name} (Trust Tier: ${merchant.trustTier}).
You are selling: ${product.name} at ₹${product.price}.
Your minimum acceptable price (policy floor) is ₹${minimumAcceptablePrice} (you can discount up to ${maxDiscountPct}%).
Delivery capability: ${product.deliveryDays} days.

The buyer is offering up to ₹${buyerOffer.maxBudget} and needs delivery within ${buyerOffer.maxDeliveryDays ?? product.deliveryDays} days.
The buyer's message: "${buyerOffer.message}"

Respond with your best offer. If the buyer's budget is within your acceptable range, offer a good price. Be professional and highlight product value.
Set originalPrice to ${product.price}, offeredPrice between ${minimumAcceptablePrice} and ${product.price}, maxDiscountAmount to ${maxDiscountAmount}.`;

  const result = await generateStructuredOutput(prompt, 'Generate a merchant offer.', MerchantOfferSchema);

  // Server-side clamp: enforce policy cap regardless of LLM output
  const clampedPrice = Math.max(result.offeredPrice, minimumAcceptablePrice);
  return {
    ...result,
    productId: product.id,
    originalPrice: product.price,
    offeredPrice: Math.min(clampedPrice, product.price), // can never be higher than list price
    maxDiscountAmount,
    canDiscount: maxDiscountPct > 0,
  };
}

async function generateMerchantFinal(
  merchantOffer: MerchantOffer,
  product: Product,
  buyerCounter: z.infer<typeof BuyerCounterSchema>,
  maxDiscountPct: number,
): Promise<z.infer<typeof MerchantFinalSchema>> {
  const minimumAcceptablePrice = product.price - Math.floor(product.price * (maxDiscountPct / 100));

  const prompt = `You are an AI Merchant Agent. The buyer has countered with ₹${buyerCounter.requestedPrice}.
Your policy floor is ₹${minimumAcceptablePrice}.
Your previous offer was ₹${merchantOffer.offeredPrice}.
Buyer's justification: "${buyerCounter.justification}"

If the buyer's requested price is at or above your floor (₹${minimumAcceptablePrice}), accept it.
Otherwise, offer your absolute best price (your floor: ₹${minimumAcceptablePrice}) and indicate you cannot go lower.`;

  const result = await generateStructuredOutput(prompt, 'Generate merchant final response.', MerchantFinalSchema);

  // Server-side clamp: final price cannot be below minimum acceptable
  const clampedFinal = Math.max(result.finalPrice, minimumAcceptablePrice);
  return {
    ...result,
    finalPrice: Math.min(clampedFinal, product.price),
  };
}

// ── Negotiation Orchestrator ──────────────────────────────────

/**
 * Run bounded Buyer ↔ Merchant negotiation.
 * Max 2 rounds. Always server-clamps the final price.
 * Returns a NegotiationResult — never throws.
 */
export async function runNegotiation(
  product: Product,
  merchant: Merchant,
  intent: ParsedIntent,
): Promise<NegotiationResult> {
  // Extract merchant's discount policy from businessRules
  const maxDiscountPct: number =
    typeof merchant.businessRules?.maxDiscountPercent === 'number'
      ? merchant.businessRules.maxDiscountPercent
      : 0;

  // If merchant has no discount capability, skip immediately
  if (maxDiscountPct <= 0) {
    return {
      outcome: 'SKIPPED',
      originalPrice: product.price,
      negotiatedPrice: product.price,
      savingsAmount: 0,
      savingsPercent: 0,
      rounds: [],
      summary: `${merchant.name} does not offer discounts on this product. Proceeding at listed price ₹${product.price}.`,
    };
  }

  const buyerBudget = intent.maximumPrice ?? product.price;
  const rounds: NegotiationRound[] = [];

  // ── Round 1: Buyer opens, Merchant responds ──────────────────
  const buyerOffer = await generateBuyerOffer(intent, product);
  const merchantOffer = await generateMerchantOffer(product, merchant, buyerOffer, maxDiscountPct);

  const round1DealReached = merchantOffer.offeredPrice <= buyerBudget;

  rounds.push({
    round: 1,
    buyerMessage: buyerOffer.message,
    buyerPrice: buyerOffer.maxBudget,
    merchantMessage: merchantOffer.message,
    merchantPrice: merchantOffer.offeredPrice,
    dealReached: round1DealReached,
  });

  if (round1DealReached) {
    const savings = product.price - merchantOffer.offeredPrice;
    return {
      outcome: 'DEAL',
      originalPrice: product.price,
      negotiatedPrice: merchantOffer.offeredPrice,
      savingsAmount: savings,
      savingsPercent: Math.round((savings / product.price) * 100),
      rounds,
      summary: `Deal reached in Round 1! ${merchant.name} offered ₹${merchantOffer.offeredPrice} (saved ₹${savings}).`,
    };
  }

  // ── Round 2: Buyer counters, Merchant gives final ────────────
  if (rounds.length < MAX_ROUNDS && merchantOffer.canDiscount) {
    const buyerCounter = await generateBuyerCounter(merchantOffer, intent);
    const merchantFinal = await generateMerchantFinal(merchantOffer, product, buyerCounter, maxDiscountPct);

    const round2DealReached = merchantFinal.finalPrice <= buyerBudget;

    rounds.push({
      round: 2,
      buyerMessage: buyerCounter.message,
      buyerPrice: buyerCounter.requestedPrice,
      merchantMessage: merchantFinal.message,
      merchantPrice: merchantFinal.finalPrice,
      dealReached: round2DealReached,
    });

    if (round2DealReached) {
      const savings = product.price - merchantFinal.finalPrice;
      return {
        outcome: 'DEAL',
        originalPrice: product.price,
        negotiatedPrice: merchantFinal.finalPrice,
        savingsAmount: savings,
        savingsPercent: Math.round((savings / product.price) * 100),
        rounds,
        summary: `Deal reached in Round 2! Final price ₹${merchantFinal.finalPrice} (saved ₹${savings}).`,
      };
    }

  }

  // No deal reached
  return {
    outcome: 'NO_DEAL',
    originalPrice: product.price,
    negotiatedPrice: product.price,
    savingsAmount: 0,
    savingsPercent: 0,
    rounds,
    summary: `No deal reached after ${rounds.length} round(s). Proceeding at listed price ₹${product.price}.`,
  };
}

// Validate a NegotiationResult (used in tests)
export function validateNegotiationResult(result: NegotiationResult): NegotiationResult {
  return NegotiationResultSchema.parse(result);
}
