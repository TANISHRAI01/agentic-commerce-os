// ============================================================
// POST /api/payment/verify — Verify Razorpay payment signature
// Server-side HMAC-SHA256 verification. Never trust frontend alone.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransaction, transitionTransaction } from '@/services/transaction';
import { createAuditEvent } from '@/audit/logger';
import {
  verifyPaymentSignature,
  RazorpayConfigError,
  RazorpayVerificationError,
} from '@/services/razorpay';

/**
 * POST /api/payment/verify — Verify a Razorpay payment after checkout.
 *
 * SECURITY:
 * - Verifies HMAC-SHA256 signature server-side
 * - Validates transaction state is PAYMENT_PENDING
 * - Validates razorpay_order_id matches the stored order ID
 * - Never trusts the frontend success callback alone
 *
 * Input: {
 *   transactionId: string,
 *   razorpay_payment_id: string,
 *   razorpay_order_id: string,
 *   razorpay_signature: string
 * }
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

    const {
      transactionId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = body;

    // ── Input validation ──
    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: transactionId' },
        { status: 400 },
      );
    }
    if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: razorpay_payment_id' },
        { status: 400 },
      );
    }
    if (!razorpay_order_id || typeof razorpay_order_id !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: razorpay_order_id' },
        { status: 400 },
      );
    }
    if (!razorpay_signature || typeof razorpay_signature !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: razorpay_signature' },
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

    // ── Guard 2: State must be PAYMENT_PENDING ──
    if (txn.state !== 'PAYMENT_PENDING') {
      return NextResponse.json(
        {
          error: 'Transaction is not awaiting payment verification',
          details: `State is "${txn.state}", expected "PAYMENT_PENDING"`,
        },
        { status: 409 },
      );
    }

    // ── Guard 3: Order ID must match ──
    if (txn.razorpayOrderId !== razorpay_order_id) {
      createAuditEvent(db, {
        transactionId,
        event: 'PAYMENT_FAILED',
        result: 'FAILURE',
        reason: `Order ID mismatch: expected "${txn.razorpayOrderId}", got "${razorpay_order_id}"`,
        metadata: {
          expectedOrderId: txn.razorpayOrderId,
          receivedOrderId: razorpay_order_id,
        },
      });

      return NextResponse.json(
        { error: 'Order ID mismatch' },
        { status: 400 },
      );
    }

    // ── Verify HMAC signature ──
    let verificationResult;
    try {
      verificationResult = verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );
    } catch (error) {
      // Signature format/length issue — treat as failed
      createAuditEvent(db, {
        transactionId,
        event: 'PAYMENT_FAILED',
        result: 'FAILURE',
        reason: `Payment signature verification error: ${error instanceof Error ? error.message : 'Unknown'}`,
        metadata: { razorpay_order_id, razorpay_payment_id },
      });

      transitionTransaction(db, transactionId, 'PAYMENT_FAILED', {
        failureReason: 'Signature verification error',
      });

      return NextResponse.json({
        success: false,
        verified: false,
        transactionId,
        transactionState: 'PAYMENT_FAILED',
        message: 'Payment verification failed',
      });
    }

    if (!verificationResult.verified) {
      // ── Signature invalid → PAYMENT_FAILED ──
      createAuditEvent(db, {
        transactionId,
        event: 'PAYMENT_FAILED',
        result: 'FAILURE',
        reason: 'Payment signature verification failed — possible tampering',
        metadata: {
          razorpay_order_id,
          razorpay_payment_id,
        },
      });

      transitionTransaction(db, transactionId, 'PAYMENT_FAILED', {
        razorpayPaymentId: razorpay_payment_id,
        failureReason: 'Signature verification failed',
      });

      return NextResponse.json({
        success: false,
        verified: false,
        transactionId,
        transactionState: 'PAYMENT_FAILED',
        message: 'Payment verification failed. Signature mismatch.',
      });
    }

    // ── Signature valid → PAYMENT_SUCCESS → VERIFIED → COMPLETED ──
    transitionTransaction(db, transactionId, 'PAYMENT_SUCCESS', {
      razorpayPaymentId: razorpay_payment_id,
    });

    createAuditEvent(db, {
      transactionId,
      event: 'PAYMENT_VERIFIED',
      result: 'SUCCESS',
      reason: `Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`,
      metadata: {
        razorpay_order_id,
        razorpay_payment_id,
        productName: txn.selectedProductName,
        amount: txn.selectedProductPrice,
      },
    });

    // Transition through VERIFIED → COMPLETED
    transitionTransaction(db, transactionId, 'VERIFIED');
    transitionTransaction(db, transactionId, 'COMPLETED');

    createAuditEvent(db, {
      transactionId,
      event: 'TRANSACTION_COMPLETE',
      result: 'SUCCESS',
      reason: `Transaction completed. Product: ${txn.selectedProductName}, Amount: ₹${txn.selectedProductPrice}`,
      metadata: {
        razorpay_payment_id,
        razorpay_order_id,
        productName: txn.selectedProductName,
        productPrice: txn.selectedProductPrice,
      },
    });

    return NextResponse.json({
      success: true,
      verified: true,
      transactionId,
      transactionState: 'COMPLETED',
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      message: 'Payment verified and transaction completed.',
    });
  } catch (error) {
    if (error instanceof RazorpayConfigError) {
      return NextResponse.json(
        { error: 'Payment service not configured', details: error.message },
        { status: 503 },
      );
    }

    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
