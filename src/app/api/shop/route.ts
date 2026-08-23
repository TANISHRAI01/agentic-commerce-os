import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { createTransaction, transitionTransaction } from '@/services/transaction';
import { createAuditEvent } from '@/audit/logger';
import { searchProducts, getProductById } from '@/services/catalog';
import { parseIntentToSearchParams } from '@/agents/discovery';
import { rankProducts, HallucinatedProductError } from '@/agents/decision';
import { LLMValidationError, LLMConnectionError } from '@/services/llm';
import type { Product } from '@/types/schemas';

/**
 * POST /api/shop — Unified AI shopping pipeline
 *
 * Single endpoint that orchestrates:
 * 1. Intent parsing (Discovery Agent)
 * 2. Catalog search (deterministic)
 * 3. Product ranking (Decision Agent)
 *
 * Returns the full shopping result in one response.
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

    const { query, idempotencyKey } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: query (non-empty string)' },
        { status: 400 },
      );
    }

    const trimmedQuery = query.trim();
    const db = await getDb();

    // ── Step 1: Create transaction ──
    const txn = createTransaction(db, { intentRaw: trimmedQuery, idempotencyKey });

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'INTENT_RECEIVED',
      result: 'INFO',
      reason: `Shopping intent received: "${trimmedQuery.substring(0, 100)}"`,
      metadata: { rawQuery: trimmedQuery },
    });

    // ── Step 2: Parse intent (LLM) ──
    transitionTransaction(db, txn.id, 'DISCOVERY');

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'DISCOVERY_STARTED',
      result: 'INFO',
      reason: 'Discovery Agent parsing natural language intent',
    });

    const { intent, searchParams } = await parseIntentToSearchParams(trimmedQuery);

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'DISCOVERY_COMPLETE',
      result: 'SUCCESS',
      reason: `Intent parsed: category="${intent.category}", maxPrice=${intent.maximumPrice ?? 'none'}, delivery=${intent.deliveryDeadline ?? 'none'}`,
      metadata: { intent, searchParams },
    });

    // ── Step 3: Search catalog (deterministic) ──
    const candidates = searchProducts(db, searchParams);

    // If no results with strict filters, try relaxing
    let products: Product[] = candidates;
    let searchRelaxed = false;

    if (products.length === 0 && searchParams.tags && searchParams.tags.length > 0) {
      // Try without tags
      const relaxedParams = { ...searchParams, tags: undefined };
      products = searchProducts(db, relaxedParams);
      searchRelaxed = true;
    }

    if (products.length === 0 && searchParams.maxPrice) {
      // Try without price constraint
      const relaxedParams = { ...searchParams, tags: undefined, maxPrice: undefined };
      products = searchProducts(db, relaxedParams);
      searchRelaxed = true;
    }

    if (products.length === 0) {
      createAuditEvent(db, {
        transactionId: txn.id,
        event: 'DISCOVERY_COMPLETE',
        result: 'WARNING',
        reason: 'No products found matching the intent',
        metadata: { searchParams },
      });

      return NextResponse.json({
        success: true,
        transactionId: txn.id,
        intent,
        products: [],
        ranking: null,
        selectedProduct: null,
        message: 'No products found matching your criteria. Try broadening your search.',
        searchRelaxed: false,
      });
    }

    // ── Step 4: Rank products (LLM) ──
    transitionTransaction(db, txn.id, 'DECISION');

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'DECISION_STARTED',
      result: 'INFO',
      reason: `Decision Agent ranking ${products.length} candidates`,
      metadata: { candidateCount: products.length },
    });

    const ranking = await rankProducts(intent, products);

    // Verify selected product in database
    const selectedProduct = getProductById(db, ranking.selectedProductId);
    if (!selectedProduct) {
      throw new HallucinatedProductError(
        ranking.selectedProductId,
        products.map(p => p.id),
      );
    }

    // Update transaction with selection
    transitionTransaction(db, txn.id, 'CART_READY', {
      selectedProductId: selectedProduct.id,
      selectedProductName: selectedProduct.name,
      selectedProductPrice: selectedProduct.price,
    });

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'DECISION_COMPLETE',
      result: 'SUCCESS',
      reason: `Recommended: ${selectedProduct.name} (₹${selectedProduct.price}) — confidence: ${ranking.confidenceScore}%`,
      metadata: {
        selectedProductId: ranking.selectedProductId,
        confidenceScore: ranking.confidenceScore,
        alternativeCount: ranking.alternatives.length,
      },
    });

    // ── Build response ──
    // Enrich alternatives with full product data
    const alternativesWithProducts = ranking.alternatives.map(alt => {
      const product = products.find(p => p.id === alt.productId);
      return {
        ...alt,
        product: product ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      transactionId: txn.id,
      intent,
      products,
      ranking: {
        ...ranking,
        alternatives: alternativesWithProducts,
      },
      selectedProduct,
      searchRelaxed,
      message: ranking.summary,
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
      console.error('LLM Validation Error:', error.message);
      if (error.rawOutput) console.error('Raw Output:', error.rawOutput);
      if (error.zodErrors) console.error('Zod Errors:', error.zodErrors);
      return NextResponse.json(
        {
          error: 'Failed to process shopping request',
          details: 'The AI could not generate a valid response. Please try rephrasing your request.',
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

    console.error('Shop pipeline error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
