// ============================================================
// POST /api/negotiate — Run bounded Buyer ↔ Merchant negotiation
//
// Called after /api/shop returns CART_READY.
// Returns NegotiationResult and stores negotiatedPrice on transaction.
// NEVER modifies payment amounts — that's Policy Engine's job.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransaction, transitionTransaction } from '@/services/transaction';
import { getProductById, getMerchantById } from '@/services/catalog';
import { createAuditEvent } from '@/audit/logger';
import { runNegotiation } from '@/agents/negotiation';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { transactionId } = body;

    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: transactionId' },
        { status: 400 },
      );
    }

    const db = await getDb();

    // ── Guard 1: Transaction must exist ──
    const txn = getTransaction(db, transactionId);
    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // ── Guard 2: Must be in CART_READY state ──
    if (txn.state !== 'CART_READY') {
      return NextResponse.json(
        { error: `Transaction must be in CART_READY state to negotiate. Current state: "${txn.state}"` },
        { status: 409 },
      );
    }

    // ── Guard 3: Product must exist ──
    if (!txn.selectedProductId) {
      return NextResponse.json(
        { error: 'No product selected on this transaction' },
        { status: 400 },
      );
    }

    const product = getProductById(db, txn.selectedProductId);
    if (!product) {
      return NextResponse.json(
        { error: 'Selected product not found in catalog' },
        { status: 404 },
      );
    }

    // ── Guard 4: Merchant must exist ──
    const merchant = getMerchantById(db, product.merchantId);
    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found for selected product' },
        { status: 404 },
      );
    }

    // ── Start negotiation ──
    transitionTransaction(db, transactionId, 'NEGOTIATING');

    createAuditEvent(db, {
      transactionId,
      event: 'NEGOTIATION_STARTED',
      result: 'INFO',
      reason: `Buyer ↔ Merchant negotiation started for ${product.name} (₹${product.price}) with ${merchant.name}`,
      metadata: {
        productId: product.id,
        originalPrice: product.price,
        merchantId: merchant.id,
        maxDiscountPercent: merchant.businessRules?.maxDiscountPercent ?? 0,
      },
    });

    // Reconstruct ParsedIntent from the transaction (best effort)
    const intent = {
      category: product.category,
      maximumPrice: txn.selectedProductPrice ?? product.price,
      minimumPrice: undefined,
      deliveryDeadline: undefined,
      requiredAttributes: [] as string[],
      preferredAttributes: [] as string[],
      exclusions: [] as string[],
      quantity: 1,
      minimumRating: undefined,
      brand: undefined,
      ambiguityQuestions: [] as string[],
    };

    // ── Run bounded negotiation ──
    let negotiationResult;
    try {
      negotiationResult = await runNegotiation(product, merchant, intent);
    } catch (negotiationError) {
      // Roll back NEGOTIATING → CART_READY so the transaction can still proceed to checkout
      console.error('Negotiation agent error — rolling back to CART_READY:', negotiationError);
      createAuditEvent(db, {
        transactionId,
        event: 'NEGOTIATION_COMPLETE',
        result: 'WARNING',
        reason: `Negotiation agent error — proceeding at listed price. Error: ${negotiationError instanceof Error ? negotiationError.message : String(negotiationError)}`,
      });
      transitionTransaction(db, transactionId, 'CART_READY');
      return NextResponse.json(
        {
          error: 'Negotiation agent failed',
          details: negotiationError instanceof Error ? negotiationError.message : String(negotiationError),
          recoverable: true,
          message: 'Proceeding at listed price. Checkout is still available.',
        },
        { status: 502 },
      );
    }

    // Emit one audit event per round
    for (const round of negotiationResult.rounds) {
      createAuditEvent(db, {
        transactionId,
        event: 'NEGOTIATION_ROUND',
        result: round.dealReached ? 'SUCCESS' : 'INFO',
        reason: `Round ${round.round}: Buyer offered ₹${round.buyerPrice}, Merchant responded ₹${round.merchantPrice}${round.dealReached ? ' — DEAL' : ''}`,
        metadata: {
          round: round.round,
          buyerPrice: round.buyerPrice,
          merchantPrice: round.merchantPrice,
          dealReached: round.dealReached,
        },
      });
    }

    const auditResult = negotiationResult.outcome === 'DEAL' ? 'SUCCESS'
                      : negotiationResult.outcome === 'SKIPPED' ? 'INFO'
                      : 'WARNING';

    createAuditEvent(db, {
      transactionId,
      event: negotiationResult.outcome === 'SKIPPED' ? 'NEGOTIATION_SKIPPED' : 'NEGOTIATION_COMPLETE',
      result: auditResult,
      reason: negotiationResult.summary,
      metadata: {
        outcome: negotiationResult.outcome,
        originalPrice: negotiationResult.originalPrice,
        negotiatedPrice: negotiationResult.negotiatedPrice,
        savingsAmount: negotiationResult.savingsAmount,
        savingsPercent: negotiationResult.savingsPercent,
        rounds: negotiationResult.rounds.length,
      },
    });

    // ── Store negotiatedPrice and transition back to CART_READY ──
    transitionTransaction(db, transactionId, 'CART_READY', {
      negotiatedPrice: negotiationResult.negotiatedPrice,
      negotiationRounds: negotiationResult.rounds.length,
      negotiationLog: JSON.stringify(negotiationResult.rounds),
    });

    return NextResponse.json({
      success: true,
      transactionId,
      negotiationResult,
    });

  } catch (error) {
    console.error('Negotiate route error:', error);
    return NextResponse.json(
      { error: 'Negotiation failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
