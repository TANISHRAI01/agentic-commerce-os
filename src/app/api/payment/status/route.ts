// ============================================================
// GET /api/payment/status — Poll payment/transaction status
// Used when frontend needs to check current state.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransaction } from '@/services/transaction';

/**
 * GET /api/payment/status?transactionId=xxx
 *
 * Returns the current transaction state and payment details.
 * Used by the frontend for polling after payment.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get('transactionId');

  if (!transactionId) {
    return NextResponse.json(
      { error: 'Missing required param: transactionId' },
      { status: 400 },
    );
  }

  const db = await getDb();
  const txn = getTransaction(db, transactionId);

  if (!txn) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    transactionId: txn.id,
    state: txn.state,
    razorpayOrderId: txn.razorpayOrderId || null,
    razorpayPaymentId: txn.razorpayPaymentId || null,
    selectedProductName: txn.selectedProductName || null,
    selectedProductPrice: txn.selectedProductPrice || null,
    failureReason: txn.failureReason || null,
  });
}
