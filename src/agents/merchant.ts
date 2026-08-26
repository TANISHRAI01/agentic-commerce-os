// ============================================================
// Merchant Agent — AI-powered optional recommendations
// Produces cross-sells, upsells, bundles, contextual offers
// ALL recommendations are optional. Buyer is never auto-charged.
// ============================================================

import {
  MerchantRecommendationsSchema,
  type MerchantRecommendations,
} from '@/types/ranking';
import type { ParsedIntent } from '@/types/intent';
import type { Product, Merchant } from '@/types/schemas';
import { generateStructuredOutput } from '@/services/llm';

// ── Custom Error ─────────────────────────────────────────────

export class HallucinatedRecommendationError extends Error {
  public readonly invalidId: string;
  public readonly validIds: string[];

  constructor(invalidId: string, validIds: string[]) {
    super(
      `Merchant Agent returned product ID "${invalidId}" which does not exist in the candidate list. ` +
      `Valid IDs: [${validIds.join(', ')}]`
    );
    this.name = 'HallucinatedRecommendationError';
    this.invalidId = invalidId;
    this.validIds = validIds;
  }
}

// ── Prompt Builder ────────────────────────────────────────────

function buildMerchantPrompt(
  selectedProduct: Product,
  allCandidates: Product[],
  merchants: Record<string, Merchant>,
  intent: ParsedIntent,
): string {
  // Exclude the already-selected product from recommendation candidates
  const otherCandidates = allCandidates.filter(p => p.id !== selectedProduct.id);

  const candidateSummary = otherCandidates.map((p, i) => {
    const m = merchants[p.merchantId];
    return (
      `${i + 1}. ID: "${p.id}" | ${p.name} | ₹${p.price} | ` +
      `Category: ${p.category} | Rating: ${p.rating}/5 | ` +
      `Delivery: ${p.deliveryDays} days | Tags: ${p.tags.join(', ')} | ` +
      `Merchant: ${m?.name ?? 'Unknown'} (${p.merchantTrustTier})`
    );
  }).join('\n');

  const selectedSummary =
    `ID: "${selectedProduct.id}" | ${selectedProduct.name} | ₹${selectedProduct.price} | ` +
    `Category: ${selectedProduct.category} | Tags: ${selectedProduct.tags.join(', ')}`;

  return `You are a merchant recommendation engine. The buyer has selected a product.
Your task is to suggest OPTIONAL add-ons from the available catalog only.

GUARDRAILS — YOU MUST FOLLOW THESE:
1. You MUST only reference product IDs from the "AVAILABLE PRODUCTS" list below.
2. You MUST NOT invent product names, prices, discounts, or stock.
3. Every recommendation is OPTIONAL — set "isOptional": true on every item.
4. Never recommend the already-selected product.
5. Prices MUST exactly match the catalog — do NOT modify them.
6. If no suitable product exists for a category, return an empty array.

BUYER'S SELECTED PRODUCT:
${selectedSummary}

BUYER'S INTENT:
- Category: ${intent.category}
- Maximum Budget: ₹${intent.maximumPrice ?? 'No limit'}
- Required attributes: ${intent.requiredAttributes.join(', ') || 'None'}

AVAILABLE PRODUCTS FOR RECOMMENDATION (use ONLY these IDs and prices):
${candidateSummary || 'No other products available.'}

RESPONSE FORMAT (valid JSON only, no markdown):
{
  "crossSells": [          // Up to 3: products from same/complementary categories that pair well
    {
      "productId": string,     // MUST be from the list above
      "productName": string,   // MUST match catalog exactly
      "price": number,         // MUST match catalog exactly
      "type": "CROSS_SELL",
      "reason": string,        // One sentence: why this pairs well
      "isOptional": true       // ALWAYS true
    }
  ],
  "upsells": [             // Up to 2: higher-value alternatives with more features
    {
      "productId": string,
      "productName": string,
      "price": number,
      "type": "UPSELL",
      "reason": string,        // One sentence: what extra value it provides
      "isOptional": true
    }
  ],
  "bundles": [             // Up to 3: products that create a useful bundle with the selected item
    {
      "productId": string,
      "productName": string,
      "price": number,
      "type": "BUNDLE",
      "reason": string,
      "isOptional": true
    }
  ],
  "contextualOffer": null | {  // Single contextual offer if strongly relevant, else null
    "productId": string,
    "productName": string,
    "price": number,
    "type": "CONTEXTUAL_OFFER",
    "reason": string,
    "isOptional": true
  },
  "summary": string            // One sentence summarizing your recommendations
}

CRITICAL: If no products are available or suitable, return empty arrays and null. Do NOT fabricate recommendations.`;
}

// ── Validation ────────────────────────────────────────────────

function validateRecommendationIds(
  recommendations: MerchantRecommendations,
  validIds: string[],
): void {
  const allItems = [
    ...recommendations.crossSells,
    ...recommendations.upsells,
    ...recommendations.bundles,
    ...(recommendations.contextualOffer ? [recommendations.contextualOffer] : []),
  ];

  for (const item of allItems) {
    if (!validIds.includes(item.productId)) {
      throw new HallucinatedRecommendationError(item.productId, validIds);
    }
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Generate optional merchant recommendations for a selected product.
 *
 * This is non-fatal — callers should catch errors and continue without
 * recommendations rather than failing the entire shopping flow.
 *
 * Guardrails:
 * - All returned product IDs are validated against the candidate list
 * - Prices are from catalog only, never mutated by LLM
 * - isOptional is enforced by the Zod schema (literal true)
 * - No payment amount is ever modified by this agent
 *
 * @param selectedProduct - The product the buyer has selected
 * @param allCandidates - Real products from catalog search
 * @param merchants - Merchant metadata map
 * @param intent - Parsed shopping intent
 */
export async function generateMerchantRecommendations(
  selectedProduct: Product,
  allCandidates: Product[],
  merchants: Record<string, Merchant>,
  intent: ParsedIntent,
): Promise<MerchantRecommendations> {
  // Need at least one other candidate to make recommendations
  const otherCandidates = allCandidates.filter(p => p.id !== selectedProduct.id);

  if (otherCandidates.length === 0) {
    return {
      crossSells: [],
      upsells: [],
      bundles: [],
      contextualOffer: null,
      summary: 'No additional products available for recommendation.',
    };
  }

  const validIds = otherCandidates.map(p => p.id);
  const systemPrompt = buildMerchantPrompt(selectedProduct, allCandidates, merchants, intent);

  const result = await generateStructuredOutput(
    systemPrompt,
    `Generate optional recommendations for buyer who selected: "${selectedProduct.name}" (₹${selectedProduct.price}). Available candidate IDs: ${validIds.join(', ')}`,
    MerchantRecommendationsSchema,
  );

  // Filter out the selected product first (LLM may accidentally include it)
  const filterSelected = (items: typeof result.crossSells) =>
    (items || []).filter(item => item.productId !== selectedProduct.id);

  const filtered = {
    ...result,
    crossSells: filterSelected(result.crossSells),
    upsells: filterSelected(result.upsells),
    bundles: filterSelected(result.bundles),
    contextualOffer:
      result.contextualOffer?.productId === selectedProduct.id
        ? null
        : result.contextualOffer,
  } as MerchantRecommendations;

  // Post-validate AFTER filtering — truly hallucinated IDs (not in validIds) are still caught
  validateRecommendationIds(filtered, validIds);

  return filtered;
}
