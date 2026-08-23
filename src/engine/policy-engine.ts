// ============================================================
// Policy Engine — Deterministic financial safety layer
// Pure function: (input) → PolicyResult
// NO LLM. NO side effects. Pure arithmetic + lookup.
// ============================================================

import type { PolicyResult, PolicyCheck, MerchantTrustTier } from '@/types/schemas';
import { PolicyEvaluationInputSchema } from '@/types/schemas';

export interface PolicyEvaluationInput {
  cartTotal: number;
  cartCurrency: string;
  merchantTrustTier: MerchantTrustTier;
  userBudget: number;
  agentSpendingLimit: number;
  approvalThreshold: number;
  allowedMerchantTiers: MerchantTrustTier[];
  configCurrency: string;
}

/**
 * Default policy configuration for demo/development.
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
 * 1. BUDGET_CHECK — cartTotal ≤ userBudget
 * 2. AGENT_SPENDING_LIMIT — cartTotal ≤ agentSpendingLimit
 * 3. MERCHANT_TRUST — merchantTrustTier ∈ allowedMerchantTiers
 * 4. CURRENCY_MATCH — cartCurrency === configCurrency
 *
 * If all checks pass and cartTotal > approvalThreshold → requiresApproval = true
 */
export function evaluatePolicy(rawInput: unknown): PolicyResult {
  // Validate input with Zod
  const input = PolicyEvaluationInputSchema.parse(rawInput);

  const checks: PolicyCheck[] = [];

  // ── Check 1: Budget ────────────────────────────────────────
  const budgetPass = input.cartTotal <= input.userBudget;
  checks.push({
    name: 'BUDGET_CHECK',
    result: budgetPass ? 'PASS' : 'FAIL',
    reason: budgetPass
      ? `Cart ₹${input.cartTotal.toLocaleString('en-IN')} is within budget ₹${input.userBudget.toLocaleString('en-IN')}`
      : `Cart ₹${input.cartTotal.toLocaleString('en-IN')} exceeds budget ₹${input.userBudget.toLocaleString('en-IN')}`,
    details: {
      actual: input.cartTotal,
      limit: input.userBudget,
    },
  });

  // ── Check 2: Agent Spending Limit ──────────────────────────
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
  const merchantPass = input.allowedMerchantTiers.includes(input.merchantTrustTier);
  checks.push({
    name: 'MERCHANT_TRUST',
    result: merchantPass ? 'PASS' : 'FAIL',
    reason: merchantPass
      ? `Merchant tier ${input.merchantTrustTier} is trusted`
      : `Merchant tier ${input.merchantTrustTier} is not in allowed tiers: [${input.allowedMerchantTiers.join(', ')}]`,
    details: {
      actual: input.merchantTrustTier,
      limit: input.allowedMerchantTiers.join(', '),
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
  const requiresApproval = allPass && input.cartTotal > input.approvalThreshold;

  return {
    overall: allPass ? 'PASS' : 'FAIL',
    requiresApproval,
    approvalReason: requiresApproval
      ? `Cart ₹${input.cartTotal.toLocaleString('en-IN')} exceeds approval threshold ₹${input.approvalThreshold.toLocaleString('en-IN')}`
      : undefined,
    checks,
  };
}
