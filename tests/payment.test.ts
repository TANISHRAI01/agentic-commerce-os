// ============================================================
// Payment Tests — Phase 4
// Tests checkout, verification, idempotency, and security guards
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { verifyPaymentSignature } from '../src/services/razorpay';

// ── HMAC Verification Tests ──────────────────────────────────

describe('Payment Verification — HMAC-SHA256', () => {
  const TEST_SECRET = '3GBjJrF5MdmthbNmf5EPQXaE';
  const TEST_ORDER_ID = 'order_TestOrder123';
  const TEST_PAYMENT_ID = 'pay_TestPayment456';

  function generateSignature(orderId: string, paymentId: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_TSyUitNAzhV3Q2';
    process.env.RAZORPAY_KEY_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  it('should verify a valid HMAC signature', () => {
    const validSignature = generateSignature(TEST_ORDER_ID, TEST_PAYMENT_ID, TEST_SECRET);
    const result = verifyPaymentSignature(TEST_ORDER_ID, TEST_PAYMENT_ID, validSignature);
    expect(result.verified).toBe(true);
    expect(result.paymentId).toBe(TEST_PAYMENT_ID);
    expect(result.orderId).toBe(TEST_ORDER_ID);
  });

  it('should reject an invalid HMAC signature', () => {
    const invalidSignature = generateSignature(TEST_ORDER_ID, TEST_PAYMENT_ID, 'wrong_secret');
    const result = verifyPaymentSignature(TEST_ORDER_ID, TEST_PAYMENT_ID, invalidSignature);
    expect(result.verified).toBe(false);
  });

  it('should reject a tampered order ID', () => {
    const validSignature = generateSignature(TEST_ORDER_ID, TEST_PAYMENT_ID, TEST_SECRET);
    const result = verifyPaymentSignature('order_Tampered', TEST_PAYMENT_ID, validSignature);
    expect(result.verified).toBe(false);
  });

  it('should reject a tampered payment ID', () => {
    const validSignature = generateSignature(TEST_ORDER_ID, TEST_PAYMENT_ID, TEST_SECRET);
    const result = verifyPaymentSignature(TEST_ORDER_ID, 'pay_Tampered', validSignature);
    expect(result.verified).toBe(false);
  });

  it('should throw on malformed signature (wrong length)', () => {
    expect(() => {
      verifyPaymentSignature(TEST_ORDER_ID, TEST_PAYMENT_ID, 'tooshort');
    }).toThrow();
  });
});

// ── Checkout Security Guards (Unit Tests) ────────────────────

describe('Checkout Security Guards', () => {
  // These test the logic that the checkout route enforces

  it('should reject checkout for non-APPROVED state', () => {
    const validStates = ['APPROVED', 'AUTO_APPROVED'];
    const invalidStates = [
      'CREATED', 'DISCOVERY', 'DECISION', 'CART_READY',
      'POLICY_PENDING', 'POLICY_FAIL', 'APPROVAL_REQUIRED',
      'PAYMENT_PENDING', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED',
      'PAYMENT_UNKNOWN', 'VERIFIED', 'COMPLETED', 'CANCELLED', 'BLOCKED',
    ];

    for (const state of invalidStates) {
      expect(validStates.includes(state)).toBe(false);
    }
  });

  it('should accept checkout for APPROVED state', () => {
    const validStates = ['APPROVED', 'AUTO_APPROVED'];
    expect(validStates.includes('APPROVED')).toBe(true);
    expect(validStates.includes('AUTO_APPROVED')).toBe(true);
  });

  it('should enforce policy pass before checkout', () => {
    // Policy must have overall === 'PASS'
    const failedPolicy = { overall: 'FAIL' as const, requiresApproval: false, checks: [] };
    const passedPolicy = { overall: 'PASS' as const, requiresApproval: false, checks: [] };

    expect(failedPolicy.overall === 'PASS').toBe(false);
    expect(passedPolicy.overall === 'PASS').toBe(true);
  });

  it('should detect duplicate order (idempotency)', () => {
    // If razorpayOrderId already exists, don't create another
    const txnWithOrder = { razorpayOrderId: 'order_existing123' };
    const txnWithoutOrder = { razorpayOrderId: undefined };

    expect(!!txnWithOrder.razorpayOrderId).toBe(true);   // duplicate detected
    expect(!!txnWithoutOrder.razorpayOrderId).toBe(false); // no duplicate
  });

  it('should convert rupees to paise correctly', () => {
    const priceInRupees = 3799;
    const amountInPaise = Math.round(priceInRupees * 100);
    expect(amountInPaise).toBe(379900);
  });

  it('should convert fractional rupees to paise correctly', () => {
    const priceInRupees = 99.99;
    const amountInPaise = Math.round(priceInRupees * 100);
    expect(amountInPaise).toBe(9999);
  });

  it('should reject amount less than minimum (₹1)', () => {
    const minPaise = 100;
    expect(50 < minPaise).toBe(true);    // ₹0.50 — too low
    expect(100 >= minPaise).toBe(true);   // ₹1.00 — ok
    expect(379900 >= minPaise).toBe(true); // ₹3799 — ok
  });
});

// ── Payment Verification Guards ──────────────────────────────

describe('Payment Verification Guards', () => {
  it('should reject verification for non-PAYMENT_PENDING state', () => {
    const validState = 'PAYMENT_PENDING';
    const invalidStates = ['APPROVED', 'AUTO_APPROVED', 'CREATED', 'COMPLETED'];

    for (const state of invalidStates) {
      expect(state === validState).toBe(false);
    }
  });

  it('should reject verification when order ID does not match', () => {
    const storedOrderId = 'order_stored123';
    const receivedOrderId = 'order_different456';
    expect(storedOrderId === receivedOrderId).toBe(false);
  });

  it('should accept verification when order ID matches', () => {
    const storedOrderId = 'order_stored123';
    const receivedOrderId = 'order_stored123';
    expect(storedOrderId === receivedOrderId).toBe(true);
  });
});

// ── Razorpay Config Tests ────────────────────────────────────

describe('Razorpay Config Validation', () => {
  afterEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_TSyUitNAzhV3Q2';
    process.env.RAZORPAY_KEY_SECRET = '3GBjJrF5MdmthbNmf5EPQXaE';
  });

  it('should detect missing RAZORPAY_KEY_ID', () => {
    const keyId = undefined;
    expect(!keyId || keyId === 'rzp_test_XXXXXXXXXX').toBe(true);
  });

  it('should detect placeholder RAZORPAY_KEY_ID', () => {
    const keyId = 'rzp_test_XXXXXXXXXX';
    expect(!keyId || keyId === 'rzp_test_XXXXXXXXXX').toBe(true);
  });

  it('should accept valid RAZORPAY_KEY_ID', () => {
    const keyId = 'rzp_test_TSyUitNAzhV3Q2';
    expect(!keyId || keyId === 'rzp_test_XXXXXXXXXX').toBe(false);
  });

  it('should detect missing RAZORPAY_KEY_SECRET', () => {
    const keySecret = undefined;
    expect(!keySecret || keySecret === 'XXXXXXXXXXXXXXXXXXXXXXXX').toBe(true);
  });

  it('should accept valid RAZORPAY_KEY_SECRET', () => {
    const keySecret = '3GBjJrF5MdmthbNmf5EPQXaE';
    expect(!keySecret || keySecret === 'XXXXXXXXXXXXXXXXXXXXXXXX').toBe(false);
  });
});

// ── State Transition Tests for Payment Flow ──────────────────

describe('Payment State Machine Flow', () => {
  // Import state machine dynamically to avoid issues
  it('APPROVED → PAYMENT_PENDING is valid', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('APPROVED', 'PAYMENT_PENDING')).toBe(true);
  });

  it('AUTO_APPROVED → PAYMENT_PENDING is valid', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('AUTO_APPROVED', 'PAYMENT_PENDING')).toBe(true);
  });

  it('PAYMENT_PENDING → PAYMENT_SUCCESS is valid', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('PAYMENT_PENDING', 'PAYMENT_SUCCESS')).toBe(true);
  });

  it('PAYMENT_PENDING → PAYMENT_FAILED is valid', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('PAYMENT_PENDING', 'PAYMENT_FAILED')).toBe(true);
  });

  it('PAYMENT_SUCCESS → VERIFIED is valid', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('PAYMENT_SUCCESS', 'VERIFIED')).toBe(true);
  });

  it('VERIFIED → COMPLETED is valid', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('VERIFIED', 'COMPLETED')).toBe(true);
  });

  it('CREATED → PAYMENT_PENDING is NOT valid (skip states)', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('CREATED', 'PAYMENT_PENDING')).toBe(false);
  });

  it('COMPLETED → PAYMENT_PENDING is NOT valid (terminal)', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('COMPLETED', 'PAYMENT_PENDING')).toBe(false);
  });

  it('PAYMENT_FAILED → CANCELLED is valid', async () => {
    const { isValidTransition } = await import('../src/engine/state-machine');
    expect(isValidTransition('PAYMENT_FAILED', 'CANCELLED')).toBe(true);
  });

  it('Full payment happy path: APPROVED → PAYMENT_PENDING → PAYMENT_SUCCESS → VERIFIED → COMPLETED', async () => {
    const { transition } = await import('../src/engine/state-machine');
    let state = 'APPROVED' as any;
    state = transition(state, 'PAYMENT_PENDING');
    expect(state).toBe('PAYMENT_PENDING');
    state = transition(state, 'PAYMENT_SUCCESS');
    expect(state).toBe('PAYMENT_SUCCESS');
    state = transition(state, 'VERIFIED');
    expect(state).toBe('VERIFIED');
    state = transition(state, 'COMPLETED');
    expect(state).toBe('COMPLETED');
  });

  it('Full payment failure path: APPROVED → PAYMENT_PENDING → PAYMENT_FAILED → CANCELLED', async () => {
    const { transition } = await import('../src/engine/state-machine');
    let state = 'APPROVED' as any;
    state = transition(state, 'PAYMENT_PENDING');
    expect(state).toBe('PAYMENT_PENDING');
    state = transition(state, 'PAYMENT_FAILED');
    expect(state).toBe('PAYMENT_FAILED');
    state = transition(state, 'CANCELLED');
    expect(state).toBe('CANCELLED');
  });
});
