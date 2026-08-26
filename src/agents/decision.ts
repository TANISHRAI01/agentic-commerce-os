// ============================================================
// Decision Agent — Product ranking with explainability
// LLM-powered recommendation from real catalog candidates
// ============================================================

import { RankingResultSchema, type RankingResult } from '@/types/ranking';
import type { ParsedIntent } from '@/types/intent';
import type { Product, Merchant } from '@/types/schemas';
import { generateStructuredOutput } from '@/services/llm';

// ── Custom Error ─────────────────────────────────────────────

export class HallucinatedProductError extends Error {
  public readonly invalidId: string;
  public readonly validIds: string[];

  constructor(invalidId: string, validIds: string[]) {
    super(
      `Decision Agent returned product ID "${invalidId}" which does not exist in the candidate list. ` +
      `Valid IDs: [${validIds.join(', ')}]`
    );
    this.name = 'HallucinatedProductError';
    this.invalidId = invalidId;
    this.validIds = validIds;
  }
}

// ── System Prompt ────────────────────────────────────────────

function buildDecisionPrompt(intent: ParsedIntent, candidates: Product[], merchants: Record<string, Merchant>): string {
  const candidateSummary = candidates.map((p, i) => {
    const m = merchants[p.merchantId];
    return `${i + 1}. ID: "${p.id}" | ${p.name} | ₹${p.price} | Rating: ${p.rating}/5 | ` +
      `Delivery: ${p.deliveryDays} days | Availability: ${p.availability} | Offers: ${p.offerEligibility.join(',')} | ` +
      `Attributes: ${JSON.stringify(p.attributes)} | Tags: ${JSON.stringify(p.tags)} | ` +
      `Merchant: ${m?.name ?? 'Unknown'} (${p.merchantTrustTier}) - Policies: ${m?.policies.join(',')} - Capabilities: ${m?.paymentCapabilities.join(',')}`;
  }).join('\n');

  return `You are a product recommendation engine. You must rank the given product candidates and select the best match for the user's shopping intent.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation, no code fences).

USER'S INTENT:
- Category: ${intent.category}
- Maximum Price: ${intent.maximumPrice ? `₹${intent.maximumPrice}` : 'No limit'}
- Minimum Price: ${intent.minimumPrice ? `₹${intent.minimumPrice}` : 'No minimum'}
- Delivery Deadline: ${intent.deliveryDeadline ? `${intent.deliveryDeadline} days` : 'No deadline'}
- Required Attributes: ${intent.requiredAttributes.length > 0 ? intent.requiredAttributes.join(', ') : 'None'}
- Preferred Attributes: ${intent.preferredAttributes.length > 0 ? intent.preferredAttributes.join(', ') : 'None'}
- Exclusions: ${intent.exclusions.length > 0 ? intent.exclusions.join(', ') : 'None'}
- Minimum Rating: ${intent.minimumRating ?? 'No minimum'}
- Brand: ${intent.brand ?? 'No preference'}

AVAILABLE PRODUCTS (you MUST only use these IDs):
${candidateSummary}

RANKING CRITERIA (in priority order):
1. Budget compliance — product price must be within the user's budget
2. Availability — must be IN_STOCK (avoid OUT_OF_STOCK unless it's the only option)
3. Required attributes — must have all required attributes
4. Delivery compliance — within delivery deadline if specified
5. Rating — higher is better
6. Preferred attributes — bonus for matching preferences
7. Merchant trust & policies — higher tier merchants preferred, better policies
8. Value for money & offers — best features and eligible offers for the price

RESPONSE FORMAT:
{
  "selectedProductId": string,  // ID of the best product (MUST be one of the IDs listed above)
  "confidenceScore": number,    // 0-100, how well this product matches the intent
  "reasons": [                  // Why this product was selected (at least 2 reasons)
    {
      "factor": string,         // Short label: "Within budget", "Fast delivery", "High rating", etc.
      "explanation": string,    // One sentence explaining this factor
      "satisfied": boolean      // Whether the constraint is met
    }
  ],
  "alternatives": [             // Other products and why they ranked lower (up to 3)
    {
      "productId": string,      // MUST be one of the IDs listed above
      "reason": string,         // Why it ranked lower
      "score": number           // 0-100 match score
    }
  ],
  "summary": string             // One sentence recommendation summary
}

CRITICAL RULES:
- You MUST ONLY use product IDs from the list above. Do NOT invent IDs.
- You MUST ONLY use prices from the list above. Do NOT modify prices.
- If no product meets the budget, select the cheapest and explain it exceeds budget.
- Provide at least 2 reasons for the selection.
- Provide up to 3 alternatives.`;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Rank product candidates and select the best match for the user's intent.
 * Validates that all returned product IDs exist in the candidate list.
 *
 * @param intent - The parsed shopping intent
 * @param candidates - Real products from the catalog (never hallucinated)
 * @returns Validated ranking result with explanations
 */
export async function rankProducts(
  intent: ParsedIntent,
  candidates: Product[],
  merchants: Record<string, Merchant>,
): Promise<RankingResult> {
  if (candidates.length === 0) {
    throw new Error('Cannot rank an empty candidate list');
  }

  const validIds = candidates.map(p => p.id);

  const systemPrompt = buildDecisionPrompt(intent, candidates, merchants);

  const result = await generateStructuredOutput(
    systemPrompt,
    `Select the best product for this shopping request. Available product IDs: ${validIds.join(', ')}`,
    RankingResultSchema,
  );

  // ── Post-validation: prevent hallucinated product IDs ──────

  // Validate selected product ID
  if (!validIds.includes(result.selectedProductId)) {
    throw new HallucinatedProductError(result.selectedProductId, validIds);
  }

  // Validate all alternative product IDs
  result.alternatives = result.alternatives || [];
  for (const alt of result.alternatives) {
    if (!validIds.includes(alt.productId)) {
      throw new HallucinatedProductError(alt.productId, validIds);
    }
  }

  // Ensure selected product is not also in alternatives
  result.alternatives = result.alternatives.filter(
    alt => alt.productId !== result.selectedProductId
  );

  return result as RankingResult;
}
