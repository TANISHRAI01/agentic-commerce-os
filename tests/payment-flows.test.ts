import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

import { POST as checkoutPOST } from '../src/app/api/checkout/route';
import { POST as verifyPOST } from '../src/app/api/payment/verify/route';

import { getDb } from '../src/db/connection';
import { createTransaction, getTransaction } from '../src/services/transaction';

// Mock Razorpay SDK
vi.mock('../src/services/razorpay', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createRazorpayOrder: vi.fn(async (amount, currency, receipt) => {
      return {
        orderId: `order_mock_${receipt}`,
        amount,
        currency,
        receipt,
      };
    }),
    getRazorpayKeyId: vi.fn(() => 'rzp_test_mock'),
    verifyPaymentSignature: vi.fn((orderId, paymentId, signature) => {
      // Simulate signature verification based on a magic signature string
      return {
        verified: signature === 'valid_signature',
        paymentId,
        orderId,
      };
    }),
  };
});

describe('Phase 4 Payment Flows (Explicit Scenarios)', () => {
  let db: any;
  let testProductId = 'prod_1';

  beforeEach(async () => {
    // Reset env vars needed by config
    process.env.RAZORPAY_KEY_ID = 'rzp_test_TSyUitNAzhV3Q2';
    process.env.RAZORPAY_KEY_SECRET = '3GBjJrF5MdmthbNmf5EPQXaE';

    db = await getDb();

    // Ensure test product and merchant exist
    db.run(`INSERT OR IGNORE INTO merchants (id, name, trust_tier) VALUES (?, ?, ?)`, ['merch_1', 'Test Merchant', 'GOLD']);
    db.run(
      `INSERT OR IGNORE INTO products (id, merchant_id, name, description, category, price) VALUES (?, ?, ?, ?, ?, ?)`,
      [testProductId, 'merch_1', 'Test Product', 'A product for testing', 'electronics', 1000]
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequest(body: any) {
    return new NextRequest('http://localhost:3000/api/mock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('Test 1: Normal payment -> PAYMENT_SUCCESS', async () => {
    // 1. Create transaction
    const txn = createTransaction(db);

    // Manually force state to APPROVED, pass policy, and set product
    db.run(
      `UPDATE transactions SET state = 'APPROVED', policy_result = ?, selected_product_id = ?, selected_product_name = ?, selected_product_price = ? WHERE id = ?`,
      [JSON.stringify({ overall: 'PASS', checks: [] }), testProductId, 'Test Product', 1000, txn.id]
    );

    // 2. Checkout
    const checkoutReq = createMockRequest({ transactionId: txn.id });
    const checkoutRes = await checkoutPOST(checkoutReq);
    const checkoutData = await checkoutRes.json();
    if (checkoutRes.status !== 200) console.log('Test 1 Checkout Error:', checkoutData);
    expect(checkoutRes.status).toBe(200);
    expect(checkoutData.razorpayOrderId).toBe(`order_mock_${txn.id}`);

    // Verify state is PAYMENT_PENDING
    const pendingTxn = getTransaction(db, txn.id);
    expect(pendingTxn?.state).toBe('PAYMENT_PENDING');

    // 3. Verify Payment with valid signature
    const verifyReq = createMockRequest({
      transactionId: txn.id,
      razorpay_order_id: checkoutData.razorpayOrderId,
      razorpay_payment_id: 'pay_mock_123',
      razorpay_signature: 'valid_signature', // triggers true in mock
    });
    const verifyRes = await verifyPOST(verifyReq);
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();

    expect(verifyData.verified).toBe(true);

    // Verify state transitioned to COMPLETED (it hits PAYMENT_SUCCESS -> VERIFIED -> COMPLETED internally)
    const finalTxn = getTransaction(db, txn.id);
    expect(finalTxn?.state).toBe('COMPLETED');
    expect(finalTxn?.razorpayPaymentId).toBe('pay_mock_123');
  });

  it('Test 2: Payment failure -> PAYMENT_FAILED', async () => {
    // 1. Create transaction
    const txn = createTransaction(db);

    db.run(
      `UPDATE transactions SET state = 'APPROVED', policy_result = ?, selected_product_id = ?, selected_product_name = ?, selected_product_price = ? WHERE id = ?`,
      [JSON.stringify({ overall: 'PASS', checks: [] }), testProductId, 'Test Product', 1000, txn.id]
    );

    // 2. Checkout
    const checkoutReq = createMockRequest({ transactionId: txn.id });
    const checkoutRes = await checkoutPOST(checkoutReq);
    const checkoutData = await checkoutRes.json();

    // 3. Verify Payment with invalid signature
    const verifyReq = createMockRequest({
      transactionId: txn.id,
      razorpay_order_id: checkoutData.razorpayOrderId,
      razorpay_payment_id: 'pay_mock_123',
      razorpay_signature: 'invalid_signature', // triggers false in mock
    });
    const verifyRes = await verifyPOST(verifyReq);
    const verifyData = await verifyRes.json();

    expect(verifyData.verified).toBe(false);
    expect(verifyData.transactionState).toBe('PAYMENT_FAILED');

    // Verify state is PAYMENT_FAILED
    const finalTxn = getTransaction(db, txn.id);
    expect(finalTxn?.state).toBe('PAYMENT_FAILED');
  });

  it('Test 3: Already paid transaction -> No second payment', async () => {
    // 1. Create transaction
    const txn = createTransaction(db);

    db.run(
      `UPDATE transactions SET state = 'COMPLETED', policy_result = ?, razorpay_order_id = ?, razorpay_payment_id = ?, selected_product_id = ?, selected_product_name = ?, selected_product_price = ? WHERE id = ?`,
      [
        JSON.stringify({ overall: 'PASS', checks: [] }),
        'order_mock_paid',
        'pay_mock_paid',
        testProductId,
        'Test Product',
        1000,
        txn.id
      ]
    );

    // 2. Attempt Checkout again
    const checkoutReq = createMockRequest({ transactionId: txn.id });
    const checkoutRes = await checkoutPOST(checkoutReq);

    // Should return 409 Conflict due to Guard 2 catching terminal state
    expect(checkoutRes.status).toBe(409);
    const checkoutData = await checkoutRes.json();
    expect(checkoutData.error).toBe('Transaction is not in a payable state');

    // 3. Attempt Verify again (simulate malicious replay)
    const verifyReq = createMockRequest({
      transactionId: txn.id,
      razorpay_order_id: 'order_mock_paid',
      razorpay_payment_id: 'pay_mock_paid_again',
      razorpay_signature: 'valid_signature',
    });
    const verifyRes = await verifyPOST(verifyReq);

    // Should return 409 Conflict because state is not PAYMENT_PENDING
    expect(verifyRes.status).toBe(409);
    const verifyData = await verifyRes.json();
    expect(verifyData.error).toBe('Transaction is not awaiting payment verification');
  });

  it('Test 4: Policy rejected transaction -> No Razorpay payment attempt', async () => {
    // 1. Create transaction
    const txn = createTransaction(db);

    db.run(
      `UPDATE transactions SET state = 'POLICY_FAIL', policy_result = ?, selected_product_id = ?, selected_product_name = ?, selected_product_price = ? WHERE id = ?`,
      [JSON.stringify({ overall: 'FAIL', checks: [] }), testProductId, 'Test Product', 1000, txn.id]
    );

    // 2. Attempt Checkout
    const checkoutReq = createMockRequest({ transactionId: txn.id });
    const checkoutRes = await checkoutPOST(checkoutReq);

    // Should return 409 Conflict due to invalid state for checkout
    expect(checkoutRes.status).toBe(409);
    const checkoutData = await checkoutRes.json();
    expect(checkoutData.error).toBe('Transaction is not in a payable state');

    // Manually force it to APPROVED but with a FAIL policy result (simulate bypass of state but not policy)
    db.run(
      `UPDATE transactions SET state = 'APPROVED', policy_result = ? WHERE id = ?`,
      [JSON.stringify({ overall: 'FAIL', checks: [] }), txn.id]
    );

    const checkoutReq2 = createMockRequest({ transactionId: txn.id });
    const checkoutRes2 = await checkoutPOST(checkoutReq2);

    // Should return 403 Forbidden because policy failed
    expect(checkoutRes2.status).toBe(403);
    const checkoutData2 = await checkoutRes2.json();
    expect(checkoutData2.error).toBe('Policy checks have not passed for this transaction');
  });
});
