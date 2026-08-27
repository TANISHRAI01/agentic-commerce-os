// ============================================================
// POST /api/checkout — Create a Razorpay order
// Server-side only. No LLM. All guards enforced.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransaction, transitionTransaction } from '@/services/transaction';
import { getProductById } from '@/services/catalog';
import { createAuditEvent } from '@/audit/logger';
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  RazorpayConfigError,
  RazorpayOrderError,
} from '@/services/razorpay';

/**
 * POST /api/checkout — Create a Razorpay order for an approved transaction.
 *
 * SECURITY GUARDS (all 8 checked before any Razorpay call):
 * 1. Transaction must exist
 * 2. Transaction state must be APPROVED or AUTO_APPROVED
 * 3. Policy must have passed
 * 4. Product must exist in DB
 * 5. Amount comes from DB (not from frontend)
 * 6. Currency validated
 * 7. Idempotency: if order already exists, return it
 * 8. Transaction must not be in a terminal state
 *
 * Input: { transactionId: string }
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
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    // ── Guard 2: State must be valid for checkout ──
    if (
      txn.state !== 'APPROVED' &&
      txn.state !== 'AUTO_APPROVED' &&
      txn.state !== 'PAYMENT_PENDING'
    ) {
      // Special case: PAYMENT_UNKNOWN requires verification before any retry
      if (txn.state === 'PAYMENT_UNKNOWN') {
        createAuditEvent(db, {
          transactionId,
          event: 'RETRY_BLOCKED',
          result: 'WARNING',
          reason: 'Checkout retry blocked: payment state is PAYMENT_UNKNOWN. Verify status via /api/payment/recover before retrying.',
          metadata: { state: txn.state, razorpayOrderId: txn.razorpayOrderId },
        });
        return NextResponse.json(
          {
            error: 'Payment is in an unknown state. Verify payment status before retrying.',
            action: 'CALL_RECOVER',
            details: 'Call POST /api/payment/recover to check payment status and reconcile.',
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: 'Transaction is not in a payable state',
          details: `State is "${txn.state}"`,
        },
        { status: 409 },
      );
    }

    // ── Guard 7: Idempotency — if order already exists, return it ──
    if (txn.razorpayOrderId) {
      createAuditEvent(db, {
        transactionId,
        event: 'DUPLICATE_PREVENTED',
        result: 'WARNING',
        reason: `Duplicate checkout attempt. Existing order: ${txn.razorpayOrderId}`,
        metadata: { existingOrderId: txn.razorpayOrderId },
      });

      // Re-apply negotiation price logic (same guard as primary path)
      // This keeps the returned amount consistent even on duplicate calls
      const product = txn.selectedProductId ? getProductById(db, txn.selectedProductId) : null;
      const dbPriceForDup = product?.price ?? txn.selectedProductPrice ?? 0;
      const dupPrice =
        txn.negotiatedPrice !== undefined && txn.negotiatedPrice > 0 && txn.negotiatedPrice < dbPriceForDup
          ? txn.negotiatedPrice
          : dbPriceForDup;

      return NextResponse.json({
        success: true,
        transactionId,
        razorpayOrderId: txn.razorpayOrderId,
        razorpayKeyId: getRazorpayKeyId(),
        amount: Math.round(dupPrice * 100),  // paise — negotiated-aware
        currency: 'INR',
        productName: txn.selectedProductName,
        duplicate: true,
      });

    }

    // ── Guard 3: Policy must have passed ──
    if (!txn.policyResult || txn.policyResult.overall !== 'PASS') {
      return NextResponse.json(
        { error: 'Policy checks have not passed for this transaction' },
        { status: 403 },
      );
    }

    // ── Guard 4 & 5: Product must exist, price from DB ──
    if (!txn.selectedProductId) {
      return NextResponse.json(
        { error: 'No product selected for this transaction' },
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

    // Use negotiatedPrice if set by Phase 9 negotiation — but ONLY if it's less than DB price
    // (safety guard: negotiation can only create discounts, never markups)
    const dbPrice = product.price;
    const priceInRupees =
      txn.negotiatedPrice !== undefined && txn.negotiatedPrice > 0 && txn.negotiatedPrice < dbPrice
        ? txn.negotiatedPrice
        : dbPrice;
    const amountInPaise = Math.round(priceInRupees * 100);

    // ── Guard 6: Currency check ──
    if (product.currency !== 'INR') {
      return NextResponse.json(
        { error: `Unsupported currency: ${product.currency}. Only INR is supported.` },
        { status: 400 },
      );
    }


    // ── Create Razorpay order ──
    const order = await createRazorpayOrder(amountInPaise, 'INR', transactionId);

    // ── Transition state ──
    transitionTransaction(db, transactionId, 'PAYMENT_PENDING', {
      razorpayOrderId: order.orderId,
    });

    // ── Audit ──
    const wasNegotiated = txn.negotiatedPrice !== undefined && txn.negotiatedPrice < dbPrice;
    createAuditEvent(db, {
      transactionId,
      event: 'ORDER_CREATED',
      result: 'SUCCESS',
      reason: wasNegotiated
        ? `Razorpay order created: ${order.orderId} for ₹${priceInRupees} (negotiated from ₹${dbPrice})`
        : `Razorpay order created: ${order.orderId} for ₹${priceInRupees}`,
      metadata: {
        razorpayOrderId: order.orderId,
        amountInPaise,
        currency: 'INR',
        productId: product.id,
        productName: product.name,
        originalPrice: dbPrice,
        finalPrice: priceInRupees,
        wasNegotiated,
        savingsAmount: wasNegotiated ? dbPrice - priceInRupees : 0,
      },
    });

    return NextResponse.json({
      success: true,
      transactionId,
      razorpayOrderId: order.orderId,
      razorpayKeyId: getRazorpayKeyId(),
      amount: amountInPaise,
      currency: 'INR',
      productName: product.name,
      productPrice: priceInRupees,
      originalPrice: dbPrice,
      wasNegotiated,
    });
  } catch (error) {
    if (error instanceof RazorpayConfigError) {
      console.error('Razorpay config error:', error.message);
      return NextResponse.json(
        { error: 'Payment service not configured', details: error.message },
        { status: 503 },
      );
    }

    if (error instanceof RazorpayOrderError) {
      console.error('Razorpay order error:', error.message);
      return NextResponse.json(
        { error: 'Failed to create payment order', details: error.message },
        { status: 502 },
      );
    }

    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
