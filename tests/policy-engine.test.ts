// ============================================================
// Policy Engine Tests — Comprehensive unit tests
// Tests all policy checks, boundaries, combinations, and malformed input
// ============================================================

import { describe, it, expect } from 'vitest';
import { evaluatePolicy, DEFAULT_POLICY_CONFIG } from '@/engine/policy-engine';
import type { MerchantTrustTier } from '@/types/schemas';

// ── Helpers ──────────────────────────────────────────────────

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    cartTotal: 2000,
    cartCurrency: 'INR',
    merchantTrustTier: 'GOLD' as MerchantTrustTier,
    userBudget: 10000,
    agentSpendingLimit: 5000,
    approvalThreshold: 3000,
    allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
    configCurrency: 'INR',
    ...overrides,
  };
}

// ── Budget Check ─────────────────────────────────────────────

describe('Policy Engine — Budget Check', () => {
  it('should PASS when cart is within budget', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 5000, userBudget: 8000 }));
    const check = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(check?.result).toBe('PASS');
  });

  it('should FAIL when cart exceeds budget', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 9000, userBudget: 8000 }));
    const check = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });

  it('should PASS when cart exactly equals budget (boundary)', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 8000, userBudget: 8000 }));
    const check = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(check?.result).toBe('PASS');
  });

  it('should PASS when cart is zero', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 0 }));
    const check = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(check?.result).toBe('PASS');
  });
});

// ── Agent Spending Limit ─────────────────────────────────────

describe('Policy Engine — Agent Spending Limit', () => {
  it('should PASS when cart is within agent limit', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 3000, agentSpendingLimit: 5000 }));
    const check = result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
    expect(check?.result).toBe('PASS');
  });

  it('should FAIL when cart exceeds agent limit', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 5800, agentSpendingLimit: 5000 }));
    const check = result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });

  it('should PASS when cart exactly equals agent limit (boundary)', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 5000, agentSpendingLimit: 5000 }));
    const check = result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
    expect(check?.result).toBe('PASS');
  });
});

// ── Merchant Trust ───────────────────────────────────────────

describe('Policy Engine — Merchant Trust', () => {
  it('should PASS for PLATINUM merchant in allowed tiers', () => {
    const result = evaluatePolicy(makeInput({ merchantTrustTier: 'PLATINUM' }));
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('PASS');
  });

  it('should PASS for GOLD merchant in allowed tiers', () => {
    const result = evaluatePolicy(makeInput({ merchantTrustTier: 'GOLD' }));
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('PASS');
  });

  it('should PASS for SILVER merchant in allowed tiers', () => {
    const result = evaluatePolicy(makeInput({ merchantTrustTier: 'SILVER' }));
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('PASS');
  });

  it('should FAIL for BRONZE merchant not in allowed tiers', () => {
    const result = evaluatePolicy(makeInput({ merchantTrustTier: 'BRONZE' }));
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });

  it('should FAIL for UNRATED merchant not in allowed tiers', () => {
    const result = evaluatePolicy(makeInput({ merchantTrustTier: 'UNRATED' }));
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });
});

// ── Currency Match ───────────────────────────────────────────

describe('Policy Engine — Currency Match', () => {
  it('should PASS when currencies match', () => {
    const result = evaluatePolicy(makeInput({ cartCurrency: 'INR', configCurrency: 'INR' }));
    const check = result.checks.find(c => c.name === 'CURRENCY_MATCH');
    expect(check?.result).toBe('PASS');
  });

  it('should FAIL when currencies do not match', () => {
    const result = evaluatePolicy(makeInput({ cartCurrency: 'USD', configCurrency: 'INR' }));
    const check = result.checks.find(c => c.name === 'CURRENCY_MATCH');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });
});

// ── Approval Threshold ───────────────────────────────────────

describe('Policy Engine — Approval Threshold', () => {
  it('should require approval when cart exceeds threshold', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 3500, approvalThreshold: 3000 }));
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalReason).toBeDefined();
  });

  it('should auto-approve when cart is below threshold', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 2500, approvalThreshold: 3000 }));
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(false);
    expect(result.approvalReason).toBeUndefined();
  });

  it('should auto-approve when cart exactly equals threshold (boundary)', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 3000, approvalThreshold: 3000 }));
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(false);
  });

  it('should NOT require approval when policy fails (even if above threshold)', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 6000,
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
    }));
    expect(result.overall).toBe('FAIL');
    expect(result.requiresApproval).toBe(false);
  });
});

// ── Overall Result ───────────────────────────────────────────

describe('Policy Engine — Overall Result', () => {
  it('should return PASS when all checks pass', () => {
    const result = evaluatePolicy(makeInput());
    expect(result.overall).toBe('PASS');
    expect(result.checks).toHaveLength(4);
    expect(result.checks.every(c => c.result === 'PASS')).toBe(true);
  });

  it('should return FAIL when any single check fails', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 12000, userBudget: 10000 }));
    expect(result.overall).toBe('FAIL');
  });

  it('should include all checks in result even when one fails', () => {
    const result = evaluatePolicy(makeInput({ merchantTrustTier: 'BRONZE' }));
    expect(result.checks).toHaveLength(4);
    const budget = result.checks.find(c => c.name === 'BUDGET_CHECK');
    const agent = result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
    const merchant = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    const currency = result.checks.find(c => c.name === 'CURRENCY_MATCH');
    expect(budget?.result).toBe('PASS');
    expect(agent?.result).toBe('PASS');
    expect(merchant?.result).toBe('FAIL');
    expect(currency?.result).toBe('PASS');
  });

  it('should report multiple failures when multiple checks fail', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 12000,
      userBudget: 10000,
      agentSpendingLimit: 5000,
      merchantTrustTier: 'UNRATED',
    }));
    expect(result.overall).toBe('FAIL');
    const failures = result.checks.filter(c => c.result === 'FAIL');
    expect(failures.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Combination Tests ────────────────────────────────────────

describe('Policy Engine — Combinations', () => {
  it('Budget PASS + Agent FAIL → overall FAIL', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 5800,
      userBudget: 8000,
      agentSpendingLimit: 5000,
    }));
    expect(result.checks.find(c => c.name === 'BUDGET_CHECK')?.result).toBe('PASS');
    expect(result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT')?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });

  it('All PASS + above threshold → PASS + approval required', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 3799,
      userBudget: 8000,
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
    }));
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(true);
  });

  it('All PASS + below threshold → PASS + auto-approved', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 2500,
      userBudget: 8000,
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
    }));
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(false);
  });

  it('Merchant FAIL + everything else PASS → overall FAIL', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 2000,
      userBudget: 8000,
      agentSpendingLimit: 5000,
      merchantTrustTier: 'BRONZE',
    }));
    expect(result.checks.find(c => c.name === 'BUDGET_CHECK')?.result).toBe('PASS');
    expect(result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT')?.result).toBe('PASS');
    expect(result.checks.find(c => c.name === 'MERCHANT_TRUST')?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });

  it('exact example from spec: ₹3,799 cart, ₹8,000 budget, ₹5,000 agent, ₹3,000 threshold', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 3799,
      userBudget: 8000,
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
      merchantTrustTier: 'GOLD',
    }));
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(true);
    expect(result.checks.find(c => c.name === 'BUDGET_CHECK')?.result).toBe('PASS');
    expect(result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT')?.result).toBe('PASS');
    expect(result.checks.find(c => c.name === 'MERCHANT_TRUST')?.result).toBe('PASS');
  });

  it('exact example from spec: ₹5,800 cart exceeds agent limit → BLOCKED', () => {
    const result = evaluatePolicy(makeInput({
      cartTotal: 5800,
      userBudget: 8000,
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
    }));
    expect(result.overall).toBe('FAIL');
    expect(result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT')?.result).toBe('FAIL');
  });
});

// ── Check Details ────────────────────────────────────────────

describe('Policy Engine — Check Details', () => {
  it('should include actual and limit in check details', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 5000, userBudget: 8000 }));
    const budget = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(budget?.details.actual).toBe(5000);
    expect(budget?.details.limit).toBe(8000);
  });

  it('should include merchant tier in check details', () => {
    const result = evaluatePolicy(makeInput({ merchantTrustTier: 'GOLD' }));
    const merchant = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(merchant?.details.actual).toBe('GOLD');
  });

  it('should include human-readable reason on failure', () => {
    const result = evaluatePolicy(makeInput({ cartTotal: 12000, userBudget: 10000 }));
    const budget = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(budget?.reason).toContain('exceeds');
  });
});

// ── Default Config ───────────────────────────────────────────

describe('Policy Engine — Default Config', () => {
  it('should have sensible default values', () => {
    expect(DEFAULT_POLICY_CONFIG.userBudget).toBe(10000);
    expect(DEFAULT_POLICY_CONFIG.agentSpendingLimit).toBe(5000);
    expect(DEFAULT_POLICY_CONFIG.approvalThreshold).toBe(3000);
    expect(DEFAULT_POLICY_CONFIG.allowedMerchantTiers).toContain('PLATINUM');
    expect(DEFAULT_POLICY_CONFIG.allowedMerchantTiers).toContain('GOLD');
    expect(DEFAULT_POLICY_CONFIG.allowedMerchantTiers).toContain('SILVER');
    expect(DEFAULT_POLICY_CONFIG.allowedMerchantTiers).not.toContain('BRONZE');
    expect(DEFAULT_POLICY_CONFIG.configCurrency).toBe('INR');
  });
});

// ── Malformed Input ──────────────────────────────────────────

describe('Policy Engine — Malformed Input', () => {
  it('should throw on missing required fields', () => {
    expect(() => evaluatePolicy({})).toThrow();
  });

  it('should throw on negative budget', () => {
    expect(() => evaluatePolicy(makeInput({ userBudget: -1000 }))).toThrow();
  });

  it('should throw on negative agent limit', () => {
    expect(() => evaluatePolicy(makeInput({ agentSpendingLimit: -500 }))).toThrow();
  });

  it('should throw on invalid merchant tier', () => {
    expect(() => evaluatePolicy(makeInput({ merchantTrustTier: 'DIAMOND' }))).toThrow();
  });

  it('should throw on empty allowed tiers array', () => {
    expect(() => evaluatePolicy(makeInput({ allowedMerchantTiers: [] }))).toThrow();
  });

  it('should throw on empty currency', () => {
    expect(() => evaluatePolicy(makeInput({ cartCurrency: '' }))).toThrow();
  });
});
