import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { transitionTransaction, getTransaction } from '@/services/transaction';
import { createAuditEvent } from '@/audit/logger';
import { getProductById } from '@/services/catalog';
import { rankProducts, HallucinatedProductError } from '@/agents/decision';
import { LLMValidationError, LLMConnectionError } from '@/services/llm';
import { ParsedIntentSchema } from '@/types/intent';
import { ProductSchema } from '@/types/schemas';
import { z } from 'zod';

const DecideRequestSchema = z.object({
  transactionId: z.string().min(1),
  intent: ParsedIntentSchema,
  products: z.array(ProductSchema).min(1, 'At least one product candidate is required'),
});

/**
 * POST /api/decide — Rank products and select a recommendation
 * Uses the Decision Agent (LLM-powered) to rank real catalog products.
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const parsed = DecideRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { transactionId, intent, products } = parsed.data;
    const db = await getDb();

    // Verify transaction exists
    const txn = getTransaction(db, transactionId);
    if (!txn) {
      return NextResponse.json(
        { error: `Transaction not found: ${transactionId}` },
        { status: 404 },
      );
    }

    createAuditEvent(db, {
      transactionId,
      event: 'DECISION_STARTED',
      result: 'INFO',
      reason: `Decision Agent ranking ${products.length} candidates`,
      metadata: { candidateCount: products.length, candidateIds: products.map(p => p.id) },
    });

    // Rank products using LLM
    const ranking = await rankProducts(intent, products);

    // Double-check: verify selected product actually exists in the database
    const selectedProduct = getProductById(db, ranking.selectedProductId);
    if (!selectedProduct) {
      createAuditEvent(db, {
        transactionId,
        event: 'DECISION_COMPLETE',
        result: 'FAILURE',
        reason: `Selected product ${ranking.selectedProductId} not found in database`,
      });

      return NextResponse.json(
        {
          error: 'Selected product does not exist in catalog',
          type: 'HALLUCINATED_PRODUCT',
        },
        { status: 422 },
      );
    }

    // Transition to DECISION state if not already there
    if (txn.state === 'DISCOVERY') {
      transitionTransaction(db, transactionId, 'DECISION');
    }

    // Update transaction with selected product
    if (txn.state === 'DISCOVERY' || txn.state === 'DECISION') {
      transitionTransaction(db, transactionId, 'CART_READY', {
        selectedProductId: selectedProduct.id,
        selectedProductName: selectedProduct.name,
        selectedProductPrice: selectedProduct.price,
      });
    }

    createAuditEvent(db, {
      transactionId,
      event: 'DECISION_COMPLETE',
      result: 'SUCCESS',
      reason: `Recommended: ${selectedProduct.name} (₹${selectedProduct.price}) — confidence: ${ranking.confidenceScore}%`,
      metadata: {
        selectedProductId: ranking.selectedProductId,
        confidenceScore: ranking.confidenceScore,
        alternativeCount: ranking.alternatives.length,
      },
    });

    return NextResponse.json({
      success: true,
      transactionId,
      ranking,
      selectedProduct,
    });
  } catch (error) {
    if (error instanceof HallucinatedProductError) {
      return NextResponse.json(
        {
          error: 'AI returned an invalid product recommendation',
          details: error.message,
          type: 'HALLUCINATED_PRODUCT',
        },
        { status: 422 },
      );
    }

    if (error instanceof LLMValidationError) {
      return NextResponse.json(
        {
          error: 'Failed to rank products',
          details: 'The AI could not generate a valid product ranking. Please try again.',
          type: 'LLM_VALIDATION_ERROR',
        },
        { status: 422 },
      );
    }

    if (error instanceof LLMConnectionError) {
      return NextResponse.json(
        {
          error: 'AI service unavailable',
          details: error.message,
          type: 'LLM_CONNECTION_ERROR',
        },
        { status: 503 },
      );
    }

    console.error('Decision error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
