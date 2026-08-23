// ============================================================
// POST /api/policy — Run deterministic policy checks
// Reads product price from DB (not frontend). Pure function decides.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransaction, transitionTransaction } from '@/services/transaction';
import { getProductById } from '@/services/catalog';
import { createAuditEvent } from '@/audit/logger';
import { evaluatePolicy, DEFAULT_POLICY_CONFIG } from '@/engine/policy-engine';
import type { MerchantTrustTier } from '@/types/schemas';

/**
 * POST /api/policy — Run policy checks against a transaction's selected product.
 *
 * The backend reads the product price from the database — NOT from the frontend.
 * This prevents price manipulation attacks.
 *
 * Input: { transactionId: string }
 * Output: { success: true, policyResult, transactionState }
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

    // ── Verify transaction exists and is in correct state ──
    const txn = getTransaction(db, transactionId);
    if (!txn) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 },
      );
    }

    if (txn.state !== 'CART_READY') {
      return NextResponse.json(
        {
          error: 'Invalid transaction state for policy check',
          details: `Transaction is in state "${txn.state}", expected "CART_READY"`,
        },
        { status: 409 },
      );
    }

    // ── Read product price from DB (NOT from frontend) ──
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

    // ── Transition to POLICY_PENDING ──
    transitionTransaction(db, transactionId, 'POLICY_PENDING');

    createAuditEvent(db, {
      transactionId,
      event: 'POLICY_CHECK',
      result: 'INFO',
      reason: `Policy check started for ${product.name} (₹${product.price})`,
      metadata: {
        productId: product.id,
        productPrice: product.price,
        merchantTrustTier: product.merchantTrustTier,
      },
    });

    // ── Run deterministic policy engine ──
    const policyResult = evaluatePolicy({
      cartTotal: product.price,
      cartCurrency: product.currency,
      merchantTrustTier: product.merchantTrustTier as MerchantTrustTier,
      ...DEFAULT_POLICY_CONFIG,
    });

    createAuditEvent(db, {
      transactionId,
      event: 'POLICY_EVALUATED',
      result: policyResult.overall === 'PASS' ? 'SUCCESS' : 'FAILURE',
      reason: `Policy ${policyResult.overall}: ${policyResult.checks.map(c => `${c.name}=${c.result}`).join(', ')}`,
      metadata: { policyResult },
    });

    // ── Transition based on policy result ──
    let nextState: 'POLICY_FAIL' | 'APPROVAL_REQUIRED' | 'AUTO_APPROVED';

    if (policyResult.overall === 'FAIL') {
      nextState = 'POLICY_FAIL';
    } else if (policyResult.requiresApproval) {
      nextState = 'APPROVAL_REQUIRED';
    } else {
      nextState = 'AUTO_APPROVED';
    }

    const updatedTxn = transitionTransaction(db, transactionId, nextState, {
      policyResult,
      approvalStatus: policyResult.requiresApproval ? 'PENDING' : undefined,
    });

    // If policy failed, block the transaction
    if (nextState === 'POLICY_FAIL') {
      transitionTransaction(db, transactionId, 'BLOCKED', {
        failureReason: `Policy check failed: ${policyResult.checks.filter(c => c.result === 'FAIL').map(c => c.reason).join('; ')}`,
      });
    }

    return NextResponse.json({
      success: true,
      policyResult,
      transactionState: nextState === 'POLICY_FAIL' ? 'BLOCKED' : nextState,
      requiresApproval: policyResult.requiresApproval,
    });
  } catch (error) {
    console.error('Policy check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
