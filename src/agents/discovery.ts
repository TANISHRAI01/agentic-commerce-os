// ============================================================
// Discovery Agent — Natural language → structured shopping intent
// LLM-powered intent parsing with schema validation
// ============================================================

import { ParsedIntentSchema, type ParsedIntent, intentToSearchParams } from '@/types/intent';
import { generateStructuredOutput } from '@/services/llm';
import type { CatalogSearchParams } from '@/types/schemas';

// ── System Prompt ────────────────────────────────────────────

const DISCOVERY_SYSTEM_PROMPT = `You are a shopping intent parser for an Indian e-commerce platform. Your job is to extract structured information from a natural language shopping request.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation, no code fences).

The JSON object must have these fields:
{
  "category": string,          // Product category. Use lowercase. Common categories: "headphones", "laptops", "smartphones", "books", "fitness", "home-kitchen", "accessories". If unclear, use "general".
  "maximumPrice": number|null, // Maximum price in INR. Parse "under ₹8,000" as 8000, "within 5k" as 5000. null if not specified.
  "minimumPrice": number|null, // Minimum price in INR. null if not specified.
  "deliveryDeadline": number|null, // Maximum acceptable delivery days. "within 3 days" = 3, "tomorrow" = 1, "next week" = 7. null if not specified.
  "requiredAttributes": string[], // Attributes that MUST be present. E.g., ["noise-cancelling", "wireless"]. Use lowercase.
  "preferredAttributes": string[], // Nice-to-have attributes. E.g., ["comfortable", "lightweight"]. Use lowercase.
  "exclusions": string[],      // Things the user does NOT want. E.g., ["wired", "heavy"]. Use lowercase.
  "quantity": number,           // How many items. Default to 1.
  "minimumRating": number|null, // Minimum acceptable rating (1.0-5.0). null if not specified.
  "brand": string|null,        // Specific brand if mentioned. null if not specified.
  "ambiguityQuestions": string[] // Questions to ask if the request is ambiguous or missing critical info. Empty if clear.
}

Rules:
- Always extract as much information as possible from the query.
- If a budget is mentioned in any format (₹, Rs, INR, "under", "below", "within", "max"), extract it.
- If the query is very vague (e.g., "buy something"), set category to "general" and add helpful ambiguity questions.
- If no price is mentioned, do NOT invent one — leave maximumPrice as null.
- If no delivery constraint is mentioned, leave deliveryDeadline as null.
- Map common terms to attributes: "ANC" = "noise-cancelling", "BT" = "bluetooth/wireless", "TWS" = "tws".
- Currency is always INR (Indian Rupees).
- Do NOT hallucinate or invent any information not in the query.`;

// ── Public API ───────────────────────────────────────────────

/**
 * Parse a natural language shopping query into a structured intent.
 * Uses LLM for understanding, validates output against schema.
 */
export async function parseIntent(rawQuery: string): Promise<ParsedIntent> {
  if (!rawQuery || rawQuery.trim().length === 0) {
    throw new Error('Shopping query cannot be empty');
  }

  const result = await generateStructuredOutput(
    DISCOVERY_SYSTEM_PROMPT,
    rawQuery.trim(),
    ParsedIntentSchema,
  );

  return {
    ...result,
    requiredAttributes: result.requiredAttributes || [],
    preferredAttributes: result.preferredAttributes || [],
    exclusions: result.exclusions || [],
    ambiguityQuestions: result.ambiguityQuestions || [],
    quantity: result.quantity || 1,
  } as ParsedIntent;
}

/**
 * Parse intent and convert to catalog search parameters.
 * Convenience function combining parsing + mapping.
 */
export async function parseIntentToSearchParams(
  rawQuery: string,
): Promise<{ intent: ParsedIntent; searchParams: CatalogSearchParams }> {
  const intent = await parseIntent(rawQuery);
  const mapped = intentToSearchParams(intent);

  // Build CatalogSearchParams compatible object
  const searchParams: CatalogSearchParams = {
    category: mapped.category,
    maxPrice: mapped.maxPrice,
    minPrice: mapped.minPrice,
    maxDeliveryDays: mapped.maxDeliveryDays,
    minRating: mapped.minRating,
    query: mapped.query,
    tags: mapped.tags,
    inStock: mapped.inStock,
    limit: mapped.limit,
    offset: mapped.offset,
  };

  return { intent, searchParams };
}
