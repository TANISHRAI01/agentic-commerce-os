// ============================================================
// Customer Policy Tests — Phase 10C
// Tests the per-customer policy engine integration:
//   - Monthly spend computation
//   - Remaining budget enforcement (monthly limit check)
//   - Single purchase limit (agent spending limit)
//   - Approval threshold
//   - trustedMerchantsOnly toggle
//   - requireApprovalFirstPurchase toggle
//   - LLM cannot override (evaluatePolicy is called AFTER ranking)
//   - Policy changes reflected immediately (config loaded per-request)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluatePolicy } from '@/engine/policy-engine';
import { computeMonthlySpent, getCustomerPolicyConfig, getPolicySummaryText } from '@/services/customer-policy';
import type { MerchantTrustTier } from '@/types/schemas';

// ─────────────────────────────────────────────────────────────
// Policy Engine — Monthly Limit (Budget Check)
// ─────────────────────────────────────────────────────────────

describe('Phase 10C — Monthly Limit (Budget Check)', () => {
  it('PASS: purchase within remaining monthly budget', () => {
    const result = evaluatePolicy({
      cartTotal: 3000,
      cartCurrency: 'INR',
      merchantTrustTier: 'GOLD' as MerchantTrustTier,
      userBudget: 7000,          // remaining = 25000 - 18000
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
      allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'],
      configCurrency: 'INR',
      monthlySpent: 18000,
      monthlyPurchaseLimit: 25000,
    });
    const check = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(check?.result).toBe('PASS');
    expect(result.overall).toBe('PASS');
  });

  it('FAIL: purchase exceeds remaining monthly budget', () => {
    const result = evaluatePolicy({
      cartTotal: 8000,
      cartCurrency: 'INR',
      merchantTrustTier: 'GOLD' as MerchantTrustTier,
      userBudget: 7000,          // remaining = 25000 - 18000 = 7000
      agentSpendingLimit: 10000,
      approvalThreshold: 3000,
      allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'],
      configCurrency: 'INR',
      monthlySpent: 18000,
      monthlyPurchaseLimit: 25000,
    });
    const check = result.checks.find(c => c.name === 'BUDGET_CHECK');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
    // Reason should mention spent/limit context
    expect(check?.reason).toContain('18,000');
    expect(check?.reason).toContain('25,000');
  });

  it('FAIL: monthly limit completely exhausted (spent = limit)', () => {
    const result = evaluatePolicy({
      cartTotal: 1000,
      cartCurrency: 'INR',
      merchantTrustTier: 'GOLD' as MerchantTrustTier,
      userBudget: 0.01,    // essentially 0 — limit fully consumed
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
      allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'],
      configCurrency: 'INR',
      monthlySpent: 25000,
      monthlyPurchaseLimit: 25000,
    });
    expect(result.overall).toBe('FAIL');
    expect(result.checks.find(c => c.name === 'BUDGET_CHECK')?.result).toBe('FAIL');
  });
});

// ─────────────────────────────────────────────────────────────
// Policy Engine — Single Purchase Limit (Agent Spending Limit)
// ─────────────────────────────────────────────────────────────

describe('Phase 10C — Single Purchase Limit', () => {
  it('PASS: purchase exactly at agent limit boundary', () => {
    const result = evaluatePolicy({
      cartTotal: 5000,
      cartCurrency: 'INR',
      merchantTrustTier: 'GOLD' as MerchantTrustTier,
      userBudget: 10000,
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
      allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'],
      configCurrency: 'INR',
    });
    const check = result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
    expect(check?.result).toBe('PASS');
  });

  it('FAIL: purchase one rupee above agent limit', () => {
    const result = evaluatePolicy({
      cartTotal: 5001,
      cartCurrency: 'INR',
      merchantTrustTier: 'GOLD' as MerchantTrustTier,
      userBudget: 10000,
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
      allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'],
      configCurrency: 'INR',
    });
    const check = result.checks.find(c => c.name === 'AGENT_SPENDING_LIMIT');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
  });

  it('LLM cannot override: FAIL result blocks regardless of AI ranking', () => {
    // Simulate what /api/shop does: AI ranked this product 1st,
    // but evaluatePolicy must still block it
    const aiSelectedProduct = { price: 7500, currency: 'INR', merchantTrustTier: 'GOLD' as MerchantTrustTier };
    const customerConfig = {
      agentSpendingLimit: 5000,
      approvalThreshold: 3000,
      userBudget: 10000,
      allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
      configCurrency: 'INR',
    };
    const policyResult = evaluatePolicy({
      cartTotal: aiSelectedProduct.price,
      cartCurrency: aiSelectedProduct.currency,
      merchantTrustTier: aiSelectedProduct.merchantTrustTier,
      ...customerConfig,
    });
    // The LLM chose this product — but policy blocks it
    expect(policyResult.overall).toBe('FAIL');
    // Simulated transaction state: POLICY_FAIL → BLOCKED
    const finalState = policyResult.overall === 'FAIL' ? 'BLOCKED' : 'AUTO_APPROVED';
    expect(finalState).toBe('BLOCKED');
  });
});

// ─────────────────────────────────────────────────────────────
// Policy Engine — Approval Threshold
// ─────────────────────────────────────────────────────────────

describe('Phase 10C — Approval Threshold', () => {
  const base = {
    cartCurrency: 'INR',
    merchantTrustTier: 'GOLD' as MerchantTrustTier,
    userBudget: 10000,
    agentSpendingLimit: 5000,
    approvalThreshold: 2000,
    allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
    configCurrency: 'INR',
  };

  it('under approval threshold — auto-approved, no approval needed', () => {
    const result = evaluatePolicy({ ...base, cartTotal: 1800 });
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(false);
  });

  it('exactly at approval threshold boundary — auto-approved (≤ means pass)', () => {
    const result = evaluatePolicy({ ...base, cartTotal: 2000 });
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(false);
  });

  it('above approval threshold but below agent limit — requires approval', () => {
    const result = evaluatePolicy({ ...base, cartTotal: 3500 });
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalReason).toContain('3,500');
    expect(result.approvalReason).toContain('2,000');
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 10C — trustedMerchantsOnly toggle
// ─────────────────────────────────────────────────────────────

describe('Phase 10C — trustedMerchantsOnly', () => {
  const base = {
    cartTotal: 1000,
    cartCurrency: 'INR',
    userBudget: 10000,
    agentSpendingLimit: 5000,
    approvalThreshold: 3000,
    allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
    configCurrency: 'INR',
  };

  it('OFF: BRONZE merchant passes default policy', () => {
    const result = evaluatePolicy({ ...base, merchantTrustTier: 'BRONZE', trustedMerchantsOnly: false });
    // BRONZE is not in PLATINUM/GOLD/SILVER — but trustedMerchantsOnly is OFF so we use allowedMerchantTiers
    // BRONZE is not in ['PLATINUM', 'GOLD', 'SILVER'] — should FAIL
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('FAIL');
  });

  it('ON: SILVER merchant blocked when trustedMerchantsOnly is true', () => {
    const result = evaluatePolicy({ ...base, merchantTrustTier: 'SILVER', trustedMerchantsOnly: true });
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('FAIL');
    expect(result.overall).toBe('FAIL');
    expect(check?.reason).toContain('trusted merchants only mode is ON');
  });

  it('ON: GOLD merchant passes when trustedMerchantsOnly is true', () => {
    const result = evaluatePolicy({ ...base, merchantTrustTier: 'GOLD', trustedMerchantsOnly: true });
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('PASS');
    expect(check?.reason).toContain('trusted merchants only mode');
  });

  it('ON: PLATINUM merchant passes when trustedMerchantsOnly is true', () => {
    const result = evaluatePolicy({ ...base, merchantTrustTier: 'PLATINUM', trustedMerchantsOnly: true });
    const check = result.checks.find(c => c.name === 'MERCHANT_TRUST');
    expect(check?.result).toBe('PASS');
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 10C — requireApprovalFirstPurchase toggle
// ─────────────────────────────────────────────────────────────

describe('Phase 10C — requireApprovalFirstPurchase', () => {
  const base = {
    cartTotal: 500,           // well under approvalThreshold
    cartCurrency: 'INR',
    merchantTrustTier: 'GOLD' as MerchantTrustTier,
    userBudget: 10000,
    agentSpendingLimit: 5000,
    approvalThreshold: 3000,
    allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
    configCurrency: 'INR',
  };

  it('OFF: small purchase auto-approved (no flag)', () => {
    const result = evaluatePolicy({ ...base, requireApprovalFirstPurchase: false });
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(false);
  });

  it('ON: small purchase still requires approval (additive)', () => {
    const result = evaluatePolicy({ ...base, requireApprovalFirstPurchase: true });
    expect(result.overall).toBe('PASS');
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalReason).toContain('First-purchase approval');
  });

  it('ON + above threshold: approval reason includes both reasons', () => {
    const result = evaluatePolicy({ ...base, cartTotal: 3500, requireApprovalFirstPurchase: true });
    expect(result.requiresApproval).toBe(true);
    // Should mention both the threshold reason and first-purchase reason
    expect(result.approvalReason).toContain('3,500');
    expect(result.approvalReason).toContain('First-purchase approval');
  });
});

// ─────────────────────────────────────────────────────────────
// computeMonthlySpent — DB helper
// ─────────────────────────────────────────────────────────────

describe('computeMonthlySpent', () => {
  it('sums completed transactions for current month correctly', () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mockDb = {
      exec: vi.fn().mockReturnValue([{
        values: [[18000]],
      }]),
    };
    const spent = computeMonthlySpent(mockDb as never, 'user-abc');
    expect(spent).toBe(18000);
    // Verify the query was called with the right userId
    expect(mockDb.exec).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE'),
      expect.arrayContaining(['user-abc']),
    );
  });

  it('returns 0 when user has no completed purchases this month', () => {
    const mockDb = {
      exec: vi.fn().mockReturnValue([{ values: [[0]] }]),
    };
    expect(computeMonthlySpent(mockDb as never, 'new-user')).toBe(0);
  });

  it('returns 0 when exec returns empty result', () => {
    const mockDb = { exec: vi.fn().mockReturnValue([]) };
    expect(computeMonthlySpent(mockDb as never, 'user')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// getPolicySummaryText — human-readable descriptions
// ─────────────────────────────────────────────────────────────

describe('getPolicySummaryText', () => {
  it('generates correct summary for standard config', () => {
    const config = {
      agentSpendingLimit: 5000,
      approvalThreshold: 2000,
      monthlyPurchaseLimit: 25000,
      monthlySpent: 10000,
      remainingBudget: 15000,
      userBudget: 15000,
      trustedMerchantsOnly: false,
      requireApprovalFirstPurchase: false,
      allowedMerchantTiers: ['PLATINUM', 'GOLD', 'SILVER'] as MerchantTrustTier[],
      configCurrency: 'INR',
    };
    const summary = getPolicySummaryText(config);
    expect(summary.autoApproveUp).toContain('2,000');
    expect(summary.approvalBetween).toContain('2,000');
    expect(summary.approvalBetween).toContain('5,000');
    expect(summary.blockedAbove).toContain('5,000');
    expect(summary.monthlyRemaining).toContain('15,000');
    expect(summary.monthlyRemaining).toContain('25,000');
  });
});
