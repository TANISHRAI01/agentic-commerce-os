import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/services/auth';
import { generateStructuredOutput, LLMConnectionError } from '@/services/llm';
import { AIProductSuggestionSchema } from '@/types/schemas';
import { z } from 'zod';

const RequestSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  currentPrice: z.number().positive().optional(),
});

/**
 * POST /api/merchant/products/ai-suggest
 *
 * Given basic product info, returns structured AI suggestions:
 * tags, improved description, suggested price (with rationale),
 * positioning note, search keywords.
 *
 * CRITICAL: Suggested price is advisory only. The merchant must explicitly
 * Accept, Edit, or Reject before it is applied to the form.
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, description, category, currentPrice } = parsed.data;

    const systemPrompt = `You are a product catalog assistant for an Indian e-commerce platform.
Given a product name, description, and category, suggest catalog metadata that will make the product
discoverable by AI buyers. All prices are in Indian Rupees (INR).

You MUST respond with ONLY a valid JSON object matching this exact schema:
{
  "suggestedTags": ["string", ...],        // 3-8 relevant tags for product discovery
  "suggestedDescription": "string",         // improved, search-friendly description (min 20 chars)
  "suggestedPrice": number,                 // suggested INR price based on category and description
  "pricingRationale": "string",             // 1-2 sentence explanation of pricing logic
  "positioningNote": "string",              // where this product fits in the market segment
  "searchKeywords": ["string", ...]         // 3-8 keywords AI buyers might use to find this product
}

Rules:
- suggestedPrice must be a reasonable INR price for the category (not 0, not negative)
- All arrays must have at least 1 item, at most 10 items
- Respond ONLY with the JSON object, no surrounding text`;

    const userPrompt = `Product Name: ${name}
Category: ${category}
Description: ${description}${currentPrice ? `\nCurrent Price: ₹${currentPrice}` : ''}

Suggest catalog metadata for this product.`;

    const suggestion = await generateStructuredOutput(
      systemPrompt,
      userPrompt,
      AIProductSuggestionSchema,
    );

    return NextResponse.json({
      suggestion,
      advisory: 'AI price suggestion is advisory only. Merchant must Accept, Edit, or Reject before it is applied.',
    });
  } catch (error) {
    if (error instanceof LLMConnectionError) {
      return NextResponse.json(
        { error: 'AI suggestions unavailable. Check GEMINI_API_KEY.', details: error.message },
        { status: 503 },
      );
    }
    console.error('[merchant/products/ai-suggest]', error);
    return NextResponse.json({ error: 'Failed to generate AI suggestions' }, { status: 500 });
  }
}
