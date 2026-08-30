// ============================================================
// Customer Dashboard Tests — Phase 10B
// Tests ownership, spending stats, empty states, profile updates.
// Uses mocked DB — no real side effects.
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock the DB module with vi.hoisted ────────────────────────
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    exec: vi.fn(),
    run: vi.fn(),
    prepare: vi.fn(),
    getRowsModified: vi.fn().mockReturnValue(1),
  };
  return { mockDb };
});

vi.mock('@/db/connection', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
  saveDb: vi.fn(),
}));

import {
  getTransactionsByUserId,
  countTransactionsByUserId,
  getTransactionForUser,
  createTransaction,
} from '@/services/transaction';

// ── Helper: Mock stmt ─────────────────────────────────────────
function mockStmt(rows: Record<string, unknown>[]) {
  let idx = 0;
  return {
    bind: vi.fn(),
    step: vi.fn(() => idx < rows.length),
    getAsObject: vi.fn(() => rows[idx++] ?? {}),
    free: vi.fn(),
  };
}

function resetMocks() {
  mockDb.exec.mockReset();
  mockDb.run.mockReset();
  mockDb.prepare.mockReset();
  mockDb.getRowsModified.mockReturnValue(1);
}

// ─────────────────────────────────────────────────────────────
// createTransaction — userId stamping
// ─────────────────────────────────────────────────────────────

describe('createTransaction — userId stamping', () => {
  beforeEach(resetMocks);

  it('stamps userId when provided', () => {
    mockDb.prepare.mockReturnValue(mockStmt([])); // no existing idempotency key
    mockDb.run.mockReturnValue(undefined);

    const txn = createTransaction(mockDb as never, {
      intentRaw: 'Buy headphones',
      userId: 'user-abc-123',
    });

    expect(txn.id).toBeTruthy();
    // Verify the INSERT was called with user_id
    const insertCall = mockDb.run.mock.calls[0];
    expect(insertCall[0]).toContain('user_id');
    expect(insertCall[1]).toContain('user-abc-123');
  });

  it('uses NULL userId when not provided (backward-compatible)', () => {
    mockDb.prepare.mockReturnValue(mockStmt([]));
    mockDb.run.mockReturnValue(undefined);

    createTransaction(mockDb as never, { intentRaw: 'Anonymous shop' });

    const insertCall = mockDb.run.mock.calls[0];
    expect(insertCall[0]).toContain('user_id');
    expect(insertCall[1]).toContain(null); // null for anonymous
  });
});

// ─────────────────────────────────────────────────────────────
// getTransactionsByUserId
// ─────────────────────────────────────────────────────────────

const MOCK_TXN_ROW = {
  id: 'txn-001',
  state: 'COMPLETED',
  intent_id: null,
  intent_raw: 'Buy headphones',
  selected_product_id: 'prod-1',
  selected_product_name: 'Sony WH-1000XM5',
  selected_product_price: 24999,
  negotiated_price: 22499,
  negotiation_rounds: 2,
  negotiation_log: null,
  policy_result: null,
  approval_status: null,
  razorpay_order_id: 'order_test_abc',
  razorpay_payment_id: 'pay_test_xyz',
  idempotency_key: 'idem-001',
  failure_reason: null,
  user_id: 'user-abc-123',
  created_at: '2026-08-30T10:00:00.000Z',
  updated_at: '2026-08-30T10:05:00.000Z',
};

describe('getTransactionsByUserId', () => {
  beforeEach(resetMocks);

  it('returns transactions for a user', () => {
    mockDb.prepare.mockReturnValue(mockStmt([MOCK_TXN_ROW]));

    const txns = getTransactionsByUserId(mockDb as never, 'user-abc-123', 20, 0);
    expect(txns).toHaveLength(1);
    expect(txns[0].id).toBe('txn-001');
    expect(txns[0].selectedProductName).toBe('Sony WH-1000XM5');
    expect(txns[0].negotiatedPrice).toBe(22499);
  });

  it('returns empty array when user has no transactions', () => {
    mockDb.prepare.mockReturnValue(mockStmt([]));

    const txns = getTransactionsByUserId(mockDb as never, 'user-no-txns', 20, 0);
    expect(txns).toHaveLength(0);
  });

  it('respects pagination limit and offset', () => {
    const stmt = mockStmt([]);
    mockDb.prepare.mockReturnValue(stmt);

    getTransactionsByUserId(mockDb as never, 'user-abc-123', 5, 10);
    // Verify bind received limit=5 and offset=10
    expect(stmt.bind).toHaveBeenCalledWith(['user-abc-123', 5, 10]);
  });
});

// ─────────────────────────────────────────────────────────────
// countTransactionsByUserId
// ─────────────────────────────────────────────────────────────

describe('countTransactionsByUserId', () => {
  beforeEach(resetMocks);

  it('returns total count for user', () => {
    mockDb.prepare.mockReturnValue(mockStmt([{ cnt: 7 }]));
    const count = countTransactionsByUserId(mockDb as never, 'user-abc-123');
    expect(count).toBe(7);
  });

  it('returns count filtered by state', () => {
    mockDb.prepare.mockReturnValue(mockStmt([{ cnt: 2 }]));
    const count = countTransactionsByUserId(mockDb as never, 'user-abc-123', 'APPROVAL_REQUIRED');
    expect(count).toBe(2);
  });

  it('returns 0 when user has no transactions', () => {
    mockDb.prepare.mockReturnValue(mockStmt([{ cnt: 0 }]));
    const count = countTransactionsByUserId(mockDb as never, 'new-user');
    expect(count).toBe(0);
  });

  it('returns correct count for completed purchases', () => {
    mockDb.prepare.mockReturnValue(mockStmt([{ cnt: 3 }]));
    const count = countTransactionsByUserId(mockDb as never, 'user-abc-123', 'COMPLETED');
    expect(count).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// getTransactionForUser — ownership enforcement
// ─────────────────────────────────────────────────────────────

describe('getTransactionForUser — ownership enforcement', () => {
  beforeEach(resetMocks);

  it('returns transaction when userId matches', () => {
    // First prepare: getTransaction SELECT
    // Second prepare: ownership check SELECT user_id
    mockDb.prepare
      .mockReturnValueOnce(mockStmt([MOCK_TXN_ROW]))           // getTransaction
      .mockReturnValueOnce(mockStmt([{ user_id: 'user-abc-123' }])); // ownership check

    const txn = getTransactionForUser(mockDb as never, 'txn-001', 'user-abc-123');
    expect(txn).not.toBeNull();
    expect(txn?.id).toBe('txn-001');
  });

  it('returns null when userId does NOT match (prevents cross-customer access)', () => {
    mockDb.prepare
      .mockReturnValueOnce(mockStmt([MOCK_TXN_ROW]))
      .mockReturnValueOnce(mockStmt([{ user_id: 'different-user' }]));

    const txn = getTransactionForUser(mockDb as never, 'txn-001', 'user-abc-123');
    expect(txn).toBeNull(); // Access denied
  });

  it('returns transaction when user_id is null (anonymous/legacy transaction)', () => {
    mockDb.prepare
      .mockReturnValueOnce(mockStmt([{ ...MOCK_TXN_ROW, user_id: null }]))
      .mockReturnValueOnce(mockStmt([{ user_id: null }]));

    // Any authenticated user can see anonymous transactions (demo mode)
    const txn = getTransactionForUser(mockDb as never, 'txn-001', 'user-abc-123');
    expect(txn).not.toBeNull();
  });

  it('returns null when transaction does not exist', () => {
    mockDb.prepare.mockReturnValue(mockStmt([])); // empty — transaction not found

    const txn = getTransactionForUser(mockDb as never, 'nonexistent', 'user-abc-123');
    expect(txn).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Customer profile spending limits
// ─────────────────────────────────────────────────────────────

describe('Customer profile schema defaults', () => {
  it('CustomerProfileSchema enforces safe defaults', async () => {
    const { CustomerProfileSchema } = await import('@/types/auth');
    const profile = CustomerProfileSchema.parse({ userId: 'u1' });
    expect(profile.agentSpendingLimit).toBe(5000);
    expect(profile.approvalThreshold).toBe(3000);
    expect(profile.monthlyPurchaseLimit).toBe(50000);
    expect(profile.monthlyIncome).toBeUndefined();
  });

  it('CustomerProfileSchema accepts custom limits', async () => {
    const { CustomerProfileSchema } = await import('@/types/auth');
    const profile = CustomerProfileSchema.parse({ userId: 'u1', agentSpendingLimit: 10000, approvalThreshold: 7500, monthlyPurchaseLimit: 100000 });
    expect(profile.agentSpendingLimit).toBe(10000);
    expect(profile.approvalThreshold).toBe(7500);
    expect(profile.monthlyPurchaseLimit).toBe(100000);
  });
});

// ─────────────────────────────────────────────────────────────
// Failed transaction states visible in history
// ─────────────────────────────────────────────────────────────

describe('Failed transaction handling', () => {
  beforeEach(resetMocks);

  it('PAYMENT_FAILED transactions are returned in user history', () => {
    const failedRow = { ...MOCK_TXN_ROW, state: 'PAYMENT_FAILED', failure_reason: 'Payment timeout', razorpay_payment_id: null };
    mockDb.prepare.mockReturnValue(mockStmt([failedRow]));

    const txns = getTransactionsByUserId(mockDb as never, 'user-abc-123');
    expect(txns[0].state).toBe('PAYMENT_FAILED');
    expect(txns[0].failureReason).toBe('Payment timeout');
  });

  it('BLOCKED transactions are returned in user history', () => {
    const blockedRow = { ...MOCK_TXN_ROW, state: 'BLOCKED', failure_reason: 'Policy check failed: Merchant trust below threshold' };
    mockDb.prepare.mockReturnValue(mockStmt([blockedRow]));

    const txns = getTransactionsByUserId(mockDb as never, 'user-abc-123');
    expect(txns[0].state).toBe('BLOCKED');
  });
});
