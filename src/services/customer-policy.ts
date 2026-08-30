// ============================================================
// Customer Policy Loader — Phase 10C
//
// Loads a customer's live policy configuration from the DB.
// Computes the remaining monthly budget by querying completed
// transactions for the current calendar month.
//
// Returns a config object that is passed directly to evaluatePolicy().
// Falls back to DEFAULT_POLICY_CONFIG for anonymous sessions.
// ============================================================

import { type Database as SqlJsDatabase } from 'sql.js';
import { DEFAULT_POLICY_CONFIG } from '@/engine/policy-engine';
import type { PolicyEvaluationInput } from '@/engine/policy-engine';
import type { MerchantTrustTier } from '@/types/schemas';

export interface CustomerPolicyConfig {
  userBudget: number;
  agentSpendingLimit: number;
  approvalThreshold: number;
  allowedMerchantTiers: MerchantTrustTier[];
  configCurrency: string;
  trustedMerchantsOnly: boolean;
  requireApprovalFirstPurchase: boolean;
  monthlySpent: number;
  monthlyPurchaseLimit: number;
  remainingBudget: number;
}

/**
 * Compute how much the customer has spent in the current calendar month.
 * Sums negotiated_price (if set) or selected_product_price for all
 * COMPLETED / VERIFIED / PAYMENT_SUCCESS transactions this month.
 */
export function computeMonthlySpent(db: SqlJsDatabase, userId: string): number {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartISO = monthStart.toISOString();

  const result = db.exec(
    `SELECT COALESCE(SUM(COALESCE(negotiated_price, selected_product_price)), 0) as total
     FROM transactions
     WHERE user_id = ?
       AND state IN ('COMPLETED', 'VERIFIED', 'PAYMENT_SUCCESS')
       AND created_at >= ?`,
    [userId, monthStartISO],
  );

  return Number(result[0]?.values?.[0]?.[0] ?? 0);
}

/**
 * Load the customer's full policy configuration from customer_profiles.
 *
 * Returns DEFAULT_POLICY_CONFIG if the user has no profile (should not happen
 * for authenticated customers, but provides a safe fallback).
 *
 * The returned object is ready to spread into evaluatePolicy():
 *   evaluatePolicy({ cartTotal, cartCurrency, merchantTrustTier, ...config })
 */
export function getCustomerPolicyConfig(
  db: SqlJsDatabase,
  userId: string,
): CustomerPolicyConfig {
  const result = db.exec(
    `SELECT
       monthly_purchase_limit,
       agent_spending_limit,
       approval_threshold,
       trusted_merchants_only,
       require_approval_first_purchase
     FROM customer_profiles
     WHERE user_id = ?`,
    [userId],
  );

  if (!result[0]?.values?.[0]) {
    // No profile found — use defaults (safe fallback)
    return {
      ...DEFAULT_POLICY_CONFIG,
      trustedMerchantsOnly: false,
      requireApprovalFirstPurchase: false,
      monthlySpent: 0,
      monthlyPurchaseLimit: DEFAULT_POLICY_CONFIG.userBudget,
      remainingBudget: DEFAULT_POLICY_CONFIG.userBudget,
    };
  }

  const [monthlyPurchaseLimit, agentSpendingLimit, approvalThreshold, trustedOnly, requireApproval] =
    result[0].values[0] as [number, number, number, number, number];

  const monthlySpent = computeMonthlySpent(db, userId);
  const remainingBudget = Math.max(0, monthlyPurchaseLimit - monthlySpent);

  // If remaining budget = 0, enforce a tiny positive number so Zod
  // validation passes and the BUDGET_CHECK correctly fails (not Zod error).
  const userBudget = remainingBudget > 0 ? remainingBudget : 0.01;

  return {
    userBudget,
    agentSpendingLimit,
    approvalThreshold,
    allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
    configCurrency: 'INR',
    trustedMerchantsOnly: Boolean(trustedOnly),
    requireApprovalFirstPurchase: Boolean(requireApproval),
    monthlySpent,
    monthlyPurchaseLimit,
    remainingBudget,
  };
}

/**
 * Returns a human-readable summary of what the customer's current
 * policy settings mean. Used by the UI spending view.
 */
export function getPolicySummaryText(config: CustomerPolicyConfig): {
  autoApproveUp: string;
  approvalBetween: string;
  blockedAbove: string;
  monthlyRemaining: string;
} {
  const { agentSpendingLimit, approvalThreshold, monthlyPurchaseLimit, monthlySpent } = config;
  const remaining = Math.max(0, monthlyPurchaseLimit - monthlySpent);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return {
    autoApproveUp: `Under ${fmt(approvalThreshold)} — auto-approved`,
    approvalBetween: `${fmt(approvalThreshold)}–${fmt(agentSpendingLimit)} — requires your approval`,
    blockedAbove: `Above ${fmt(agentSpendingLimit)} — blocked by agent limit`,
    monthlyRemaining: `${fmt(remaining)} remaining of ${fmt(monthlyPurchaseLimit)} this month`,
  };
}
