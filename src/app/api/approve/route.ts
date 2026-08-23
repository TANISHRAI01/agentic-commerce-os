// ============================================================
// POST /api/approve — Record user approval/rejection
// Triple-verifies transaction state before allowing authorization.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransaction, transitionTransaction } from '@/services/transaction';
import { createAuditEvent } from '@/audit/logger';

/**
 * POST /api/approve — Process user approval or rejection.
 *
 * SECURITY: Backend independently verifies before processing:
 * 1. Transaction must exist
 * 2. Transaction state must be APPROVAL_REQUIRED
 * 3. policyResult.overall must be PASS
 * 4. policyResult.requiresApproval must be true
 *
 * Input: { transactionId: string, decision: 'APPROVED' | 'REJECTED' }
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

    const { transactionId, decision } = body;

    // ── Input validation ──
    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: transactionId' },
        { status: 400 },
      );
    }

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be "APPROVED" or "REJECTED"' },
        { status: 400 },
      );
    }

    const db = await getDb();

    // ── Verification 1: Transaction must exist ──
    const txn = getTransaction(db, transactionId);
    if (!txn) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    // ── Verification 2: State must be APPROVAL_REQUIRED ──
    if (txn.state !== 'APPROVAL_REQUIRED') {
      return NextResponse.json(
        {
          error: 'Transaction is not awaiting approval',
          details: `Transaction is in state "${txn.state}", expected "APPROVAL_REQUIRED"`,
        },
        { status: 409 },
      );
    }

    // ── Verification 3: Policy must have passed ──
    if (!txn.policyResult || txn.policyResult.overall !== 'PASS') {
      return NextResponse.json(
        {
          error: 'Cannot approve: policy checks did not pass',
          details: 'The transaction policy result is not PASS',
        },
        { status: 403 },
      );
    }

    // ── Verification 4: Approval must be required ──
    if (!txn.policyResult.requiresApproval) {
      return NextResponse.json(
        {
          error: 'Cannot approve: approval is not required for this transaction',
          details: 'This transaction was auto-approved or does not need approval',
        },
        { status: 409 },
      );
    }

    // ── Process decision ──
    if (decision === 'APPROVED') {
      const updatedTxn = transitionTransaction(db, transactionId, 'APPROVED', {
        approvalStatus: 'APPROVED',
      });

      createAuditEvent(db, {
        transactionId,
        event: 'APPROVAL_GRANTED',
        result: 'SUCCESS',
        reason: `User approved purchase of ${txn.selectedProductName} (₹${txn.selectedProductPrice})`,
        metadata: {
          productId: txn.selectedProductId,
          productName: txn.selectedProductName,
          productPrice: txn.selectedProductPrice,
        },
      });

      return NextResponse.json({
        success: true,
        transactionId,
        decision: 'APPROVED',
        transactionState: 'APPROVED',
        message: 'Purchase authorized. Ready for payment.',
      });
    } else {
      // REJECTED → BLOCKED (terminal)
      transitionTransaction(db, transactionId, 'BLOCKED', {
        approvalStatus: 'REJECTED',
        failureReason: 'User rejected the purchase',
      });

      createAuditEvent(db, {
        transactionId,
        event: 'APPROVAL_REJECTED',
        result: 'FAILURE',
        reason: `User rejected purchase of ${txn.selectedProductName} (₹${txn.selectedProductPrice})`,
        metadata: {
          productId: txn.selectedProductId,
          productName: txn.selectedProductName,
          productPrice: txn.selectedProductPrice,
        },
      });

      return NextResponse.json({
        success: true,
        transactionId,
        decision: 'REJECTED',
        transactionState: 'BLOCKED',
        message: 'Purchase rejected.',
      });
    }
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
