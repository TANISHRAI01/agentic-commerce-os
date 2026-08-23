// ============================================================
// POST /api/payment/recover — Reconcile PAYMENT_UNKNOWN state
//
// The ONLY place verify-before-retry executes.
// No LLM. Fully deterministic. Every branch is audited.
//
// Precondition: transaction must be in PAYMENT_UNKNOWN state.
// Postcondition: transaction is in PAYMENT_SUCCESS/COMPLETED,
//                PAYMENT_FAILED/CANCELLED, or remains PAYMENT_UNKNOWN
//                if the external check itself fails.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransaction, transitionTransaction } from '@/services/transaction';
import { createAuditEvent } from '@/audit/logger';
import { fetchOrderStatus, RazorpayConfigError, RazorpayOrderError } from '@/services/razorpay';
import {
  getSimulatorMode,
  isSimulatorActive,
  simulateFetchOrderStatus,
} from '@/services/payment-simulator';

/**
 * POST /api/payment/recover
 *
 * Input:  { transactionId: string }
 * Output: { reconciled: boolean, outcome: 'SUCCESS' | 'FAILED' | 'STILL_UNKNOWN', transactionState: string }
 */
export async function POST(request: NextRequest) {
  try {
    let body: { transactionId?: string };
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

    // ── Guard 2: Must be in PAYMENT_UNKNOWN state ──
    if (txn.state !== 'PAYMENT_UNKNOWN') {
      return NextResponse.json(
        {
          error: 'Transaction is not in PAYMENT_UNKNOWN state',
          details: `State is "${txn.state}". Recovery only applies to PAYMENT_UNKNOWN transactions.`,
        },
        { status: 409 },
      );
    }

    // ── Guard 3: Must have a Razorpay order to check ──
    if (!txn.razorpayOrderId) {
      return NextResponse.json(
        { error: 'No Razorpay order associated with this transaction. Cannot recover.' },
        { status: 422 },
      );
    }

    // ── Audit: starting the status check ──
    createAuditEvent(db, {
      transactionId,
      event: 'PAYMENT_STATUS_POLLED',
      result: 'INFO',
      reason: `Verifying payment status with provider for order ${txn.razorpayOrderId}`,
      metadata: {
        razorpayOrderId: txn.razorpayOrderId,
        fromState: 'PAYMENT_UNKNOWN',
        simulatorMode: getSimulatorMode() ?? 'NORMAL',
      },
    });

    // ── Fetch external status (real or simulated) ──
    let orderStatus: { status: string; amountPaid: number; attempts: number };
    try {
      if (isSimulatorActive()) {
        orderStatus = await simulateFetchOrderStatus(txn.razorpayOrderId);
      } else {
        orderStatus = await fetchOrderStatus(txn.razorpayOrderId);
      }
    } catch (err: any) {
      // External check itself failed → remain UNKNOWN, do NOT charge again
      createAuditEvent(db, {
        transactionId,
        event: 'RECOVERY_ATTEMPTED',
        result: 'FAILURE',
        reason: `Failed to fetch payment status from provider: ${err?.message ?? 'Unknown error'}`,
        metadata: { razorpayOrderId: txn.razorpayOrderId, error: err?.message },
      });

      return NextResponse.json(
        {
          reconciled: false,
          outcome: 'STILL_UNKNOWN',
          transactionState: 'PAYMENT_UNKNOWN',
          message: 'Could not reach payment provider. Payment state remains unknown. Do NOT retry payment.',
          error: err?.message,
        },
        { status: 503 },
      );
    }

    // ── Deterministic reconciliation branch ──
    if (orderStatus.status === 'paid') {
      // Payment succeeded — reconcile to COMPLETED
      transitionTransaction(db, transactionId, 'PAYMENT_SUCCESS');
      transitionTransaction(db, transactionId, 'VERIFIED');
      transitionTransaction(db, transactionId, 'COMPLETED');

      createAuditEvent(db, {
        transactionId,
        event: 'PAYMENT_RECONCILED',
        result: 'SUCCESS',
        reason: `Payment confirmed as PAID by provider. Reconciled to COMPLETED. No duplicate payment created.`,
        metadata: {
          razorpayOrderId: txn.razorpayOrderId,
          providerStatus: orderStatus.status,
          amountPaid: orderStatus.amountPaid,
          attempts: orderStatus.attempts,
          fromState: 'PAYMENT_UNKNOWN',
          toState: 'COMPLETED',
        },
      });

      return NextResponse.json({
        reconciled: true,
        outcome: 'SUCCESS',
        transactionState: 'COMPLETED',
        message: 'Payment confirmed as successful. Order complete. No duplicate payment was created.',
      });
    }

    // 'attempted' or 'created' → payment did not complete → mark as failed
    transitionTransaction(db, transactionId, 'PAYMENT_FAILED', {
      failureReason: `Payment not completed. Provider status: ${orderStatus.status}`,
    });

    createAuditEvent(db, {
      transactionId,
      event: 'PAYMENT_RECONCILED',
      result: 'FAILURE',
      reason: `Payment confirmed as NOT paid by provider (status: ${orderStatus.status}). Marked as PAYMENT_FAILED.`,
      metadata: {
        razorpayOrderId: txn.razorpayOrderId,
        providerStatus: orderStatus.status,
        amountPaid: orderStatus.amountPaid,
        attempts: orderStatus.attempts,
        fromState: 'PAYMENT_UNKNOWN',
        toState: 'PAYMENT_FAILED',
      },
    });

    return NextResponse.json({
      reconciled: true,
      outcome: 'FAILED',
      transactionState: 'PAYMENT_FAILED',
      message: `Payment was not completed (provider status: "${orderStatus.status}"). Transaction marked as failed. A new payment may be initiated after re-authorization.`,
    });
  } catch (error) {
    if (error instanceof RazorpayConfigError) {
      return NextResponse.json(
        { error: 'Payment service not configured', details: error.message },
        { status: 503 },
      );
    }

    console.error('[/api/payment/recover] Internal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
