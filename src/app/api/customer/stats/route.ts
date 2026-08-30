// GET /api/customer/stats
// Protected by middleware. Returns spending stats and activity for the authenticated customer.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransactionsByUserId, countTransactionsByUserId } from '@/services/transaction';
import { getAuditTrail } from '@/audit/logger';
import { getCustomerPolicyConfig } from '@/services/customer-policy';


export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const db = await getDb();

    // ── Monthly spending ──────────────────────────────────────
    // Sum of negotiated_price (if set) or selected_product_price for COMPLETED/VERIFIED this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const spendResult = db.exec(
      `SELECT COALESCE(SUM(COALESCE(negotiated_price, selected_product_price)), 0) as total
       FROM transactions
       WHERE user_id = ?
         AND state IN ('COMPLETED', 'VERIFIED', 'PAYMENT_SUCCESS')
         AND created_at >= ?`,
      [userId, monthStart],
    );
    const totalSpentThisMonth = Number(spendResult[0]?.values?.[0]?.[0] ?? 0);

    // ── Pending approvals ─────────────────────────────────────
    const pendingApprovals = countTransactionsByUserId(db, userId, 'APPROVAL_REQUIRED');

    // ── Total transactions ────────────────────────────────────
    const totalTransactions = countTransactionsByUserId(db, userId);

    // ── Completed purchases ───────────────────────────────────
    const completedPurchases =
      countTransactionsByUserId(db, userId, 'COMPLETED') +
      countTransactionsByUserId(db, userId, 'VERIFIED') +
      countTransactionsByUserId(db, userId, 'PAYMENT_SUCCESS');

    // ── Recent activity: last 15 audit events across all customer txns ──
    const recentTransactions = getTransactionsByUserId(db, userId, 20, 0);
    const recentActivity: Array<{
      transactionId: string;
      intentRaw: string | undefined;
      event: string;
      result: string;
      reason: string;
      timestamp: string;
    }> = [];

    for (const txn of recentTransactions.slice(0, 8)) {
      const events = getAuditTrail(db, txn.id);
      for (const ev of events.slice(-2)) {
        // Skip internal STATE_TRANSITION noise for activity feed
        if (ev.event === 'STATE_TRANSITION') continue;
        recentActivity.push({
          transactionId: txn.id,
          intentRaw: txn.intentRaw,
          event: ev.event,
          result: ev.result,
          reason: ev.reason,
          timestamp: ev.timestamp,
        });
      }
      if (recentActivity.length >= 15) break;
    }

    // Sort by timestamp desc, take top 10
    recentActivity.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Phase 10C: include live policy context (authoritative server-side)
    const policyConfig = getCustomerPolicyConfig(db, userId);

    return NextResponse.json({
      totalSpentThisMonth: policyConfig.monthlySpent, // use policy service value (authoritative)
      pendingApprovals,
      totalTransactions,
      completedPurchases,
      recentActivity: recentActivity.slice(0, 10),
      // Spending & Limits context
      spending: {
        monthlySpent: policyConfig.monthlySpent,
        monthlyPurchaseLimit: policyConfig.monthlyPurchaseLimit,
        remainingBudget: policyConfig.remainingBudget,
        agentSpendingLimit: policyConfig.agentSpendingLimit,
        approvalThreshold: policyConfig.approvalThreshold,
        trustedMerchantsOnly: policyConfig.trustedMerchantsOnly,
        requireApprovalFirstPurchase: policyConfig.requireApprovalFirstPurchase,
      },
    });

  } catch (err) {
    console.error('[/api/customer/stats] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
