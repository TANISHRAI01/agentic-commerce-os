// ============================================================
// Policy Engine — Deterministic financial safety layer
// Pure function: (input) → PolicyResult
// NO LLM. NO side effects. Pure arithmetic + lookup.
//
// Phase 10C: Extended with per-customer controls:
//   - trustedMerchantsOnly: only PLATINUM/GOLD merchants trusted
//   - requireApprovalFirstPurchase: always requires approval (additive)
//   - monthlySpent: used for BUDGET_CHECK context in reason messages
// ============================================================

import type { PolicyResult, PolicyCheck, MerchantTrustTier } from '@/types/schemas';
import { PolicyEvaluationInputSchema } from '@/types/schemas';

export interface PolicyEvaluationInput {
  cartTotal: number;
  cartCurrency: string;
  merchantTrustTier: MerchantTrustTier;
  userBudget: number;           // Remaining budget = monthlyPurchaseLimit - monthlySpent
  agentSpendingLimit: number;   // Max single AI purchase
  approvalThreshold: number;    // Above this → requires approval
  allowedMerchantTiers: MerchantTrustTier[];
  configCurrency: string;
  // Phase 10C: new optional controls (all backward-compatible defaults)
  trustedMerchantsOnly?: boolean;           // Override allowedTiers to PLATINUM/GOLD only
  requireApprovalFirstPurchase?: boolean;   // Force approval even below threshold
  monthlySpent?: number;                    // For enriched audit reason messages
  monthlyPurchaseLimit?: number;            // For enriched audit reason messages
}

/**
 * Default policy configuration for demo/development (anonymous sessions).
 * Used when no authenticated customer profile is available.
 */
export const DEFAULT_POLICY_CONFIG = {
  userBudget: 10000,
  agentSpendingLimit: 5000,
  approvalThreshold: 3000,
  allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
  configCurrency: 'INR',
};

/**
 * Evaluate the policy against a cart/product selection.
 *
 * This is a PURE FUNCTION — no database access, no LLM, no side effects.
 * All data must be passed in as input.
 *
 * Checks (in order):
 * 1. BUDGET_CHECK         — cartTotal ≤ userBudget (remaining monthly budget)
 * 2. AGENT_SPENDING_LIMIT — cartTotal ≤ agentSpendingLimit (single purchase cap)
 * 3. MERCHANT_TRUST       — merchantTrustTier ∈ allowedMerchantTiers
 *                            (if trustedMerchantsOnly: only PLATINUM/GOLD pass)
 * 4. CURRENCY_MATCH       — cartCurrency === configCurrency
 *
 * If all pass:
 *   - cartTotal > approvalThreshold           → requiresApproval = true
 *   - requireApprovalFirstPurchase = true     → requiresApproval = true (additive)
 *
 * LLM output CANNOT bypass this function. It is called after all AI steps complete.
 */
export function evaluatePolicy(rawInput: unknown): PolicyResult {
  // Validate input with Zod — rejects malformed data before any evaluation
  const input = PolicyEvaluationInputSchema.parse(rawInput) as PolicyEvaluationInput;

  const checks: PolicyCheck[] = [];

  // ── Phase 10C: resolve effective merchant tiers ────────────
  const effectiveMerchantTiers: MerchantTrustTier[] = input.trustedMerchantsOnly
    ? ['PLATINUM', 'GOLD']
    : input.allowedMerchantTiers;

  // ── Check 1: Remaining Monthly Budget ──────────────────────
  const budgetPass = input.cartTotal <= input.userBudget;
  const budgetContext = input.monthlySpent !== undefined && input.monthlyPurchaseLimit !== undefined
    ? ` (monthly: ₹${input.monthlySpent.toLocaleString('en-IN')} spent of ₹${input.monthlyPurchaseLimit.toLocaleString('en-IN')} limit)`
    : '';
  checks.push({
    name: 'BUDGET_CHECK',
    result: budgetPass ? 'PASS' : 'FAIL',
    reason: budgetPass
      ? `Remaining budget ₹${input.userBudget.toLocaleString('en-IN')} covers cart ₹${input.cartTotal.toLocaleString('en-IN')}${budgetContext}`
      : `Cart ₹${input.cartTotal.toLocaleString('en-IN')} exceeds remaining budget ₹${input.userBudget.toLocaleString('en-IN')}${budgetContext}`,
    details: {
      actual: input.cartTotal,
      limit: input.userBudget,
    },
  });

  // ── Check 2: Agent Spending Limit (single purchase cap) ────
  const agentPass = input.cartTotal <= input.agentSpendingLimit;
  checks.push({
    name: 'AGENT_SPENDING_LIMIT',
    result: agentPass ? 'PASS' : 'FAIL',
    reason: agentPass
      ? `Cart ₹${input.cartTotal.toLocaleString('en-IN')} is within agent limit ₹${input.agentSpendingLimit.toLocaleString('en-IN')}`
      : `Cart ₹${input.cartTotal.toLocaleString('en-IN')} exceeds agent limit ₹${input.agentSpendingLimit.toLocaleString('en-IN')}`,
    details: {
      actual: input.cartTotal,
      limit: input.agentSpendingLimit,
    },
  });

  // ── Check 3: Merchant Trust ────────────────────────────────
  const merchantPass = effectiveMerchantTiers.includes(input.merchantTrustTier);
  checks.push({
    name: 'MERCHANT_TRUST',
    result: merchantPass ? 'PASS' : 'FAIL',
    reason: merchantPass
      ? `Merchant tier ${input.merchantTrustTier} is trusted${input.trustedMerchantsOnly ? ' (trusted merchants only mode)' : ''}`
      : `Merchant tier ${input.merchantTrustTier} is not in allowed tiers: [${effectiveMerchantTiers.join(', ')}]${input.trustedMerchantsOnly ? ' — trusted merchants only mode is ON' : ''}`,
    details: {
      actual: input.merchantTrustTier,
      limit: effectiveMerchantTiers.join(', '),
    },
  });

  // ── Check 4: Currency Match ────────────────────────────────
  const currencyPass = input.cartCurrency === input.configCurrency;
  checks.push({
    name: 'CURRENCY_MATCH',
    result: currencyPass ? 'PASS' : 'FAIL',
    reason: currencyPass
      ? `Currency ${input.cartCurrency} matches expected ${input.configCurrency}`
      : `Currency ${input.cartCurrency} does not match expected ${input.configCurrency}`,
    details: {
      actual: input.cartCurrency,
      limit: input.configCurrency,
    },
  });

  // ── Overall result ─────────────────────────────────────────
  const allPass = checks.every(c => c.result === 'PASS');

  // Approval required if:
  // 1. All policy checks pass AND cart exceeds approvalThreshold, OR
  // 2. requireApprovalFirstPurchase flag is set (additive — never removes approval)
  const requiresApproval = allPass && (
    input.cartTotal > input.approvalThreshold ||
    Boolean(input.requireApprovalFirstPurchase)
  );

  const approvalReasons: string[] = [];
  if (allPass && input.cartTotal > input.approvalThreshold) {
    approvalReasons.push(`Cart ₹${input.cartTotal.toLocaleString('en-IN')} exceeds approval threshold ₹${input.approvalThreshold.toLocaleString('en-IN')}`);
  }
  if (allPass && input.requireApprovalFirstPurchase) {
    approvalReasons.push('First-purchase approval required by your settings');
  }

  return {
    overall: allPass ? 'PASS' : 'FAIL',
    requiresApproval,
    approvalReason: approvalReasons.length > 0 ? approvalReasons.join('; ') : undefined,
    checks,
  };
}
