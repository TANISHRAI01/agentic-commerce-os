// ============================================================
// Razorpay Payment Service — Server-side only
// No LLM involvement. Pure deterministic payment operations.
// ============================================================

import crypto from 'crypto';

// ── Types ────────────────────────────────────────────────────

export interface RazorpayOrderResult {
  orderId: string;
  amount: number;      // in paise
  currency: string;
  receipt: string;
}

export interface RazorpayVerificationResult {
  verified: boolean;
  paymentId: string;
  orderId: string;
}

// ── Errors ───────────────────────────────────────────────────

export class RazorpayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RazorpayConfigError';
  }
}

export class RazorpayOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RazorpayOrderError';
  }
}

export class RazorpayVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RazorpayVerificationError';
  }
}

// ── Config ───────────────────────────────────────────────────

function getConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || keyId === 'rzp_test_XXXXXXXXXX') {
    throw new RazorpayConfigError('RAZORPAY_KEY_ID is not configured. Set it in .env');
  }
  if (!keySecret || keySecret === 'XXXXXXXXXXXXXXXXXXXXXXXX') {
    throw new RazorpayConfigError('RAZORPAY_KEY_SECRET is not configured. Set it in .env');
  }

  return { keyId, keySecret };
}

/**
 * Get the Razorpay key ID (safe for frontend).
 */
export function getRazorpayKeyId(): string {
  return getConfig().keyId;
}

// ── Razorpay SDK Instance ────────────────────────────────────

let razorpayInstance: any = null;

async function getRazorpayInstance() {
  if (razorpayInstance) return razorpayInstance;

  const { keyId, keySecret } = getConfig();
  const Razorpay = (await import('razorpay')).default;
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
  return razorpayInstance;
}

// ── Order Creation ───────────────────────────────────────────

/**
 * Create a Razorpay order.
 *
 * @param amountInPaise - Amount in paise (₹1 = 100 paise)
 * @param currency - Currency code (e.g., 'INR')
 * @param receipt - Unique receipt identifier (transaction ID)
 */
export async function createRazorpayOrder(
  amountInPaise: number,
  currency: string,
  receipt: string,
): Promise<RazorpayOrderResult> {
  if (amountInPaise <= 0) {
    throw new RazorpayOrderError('Amount must be positive');
  }
  if (amountInPaise < 100) {
    throw new RazorpayOrderError('Minimum order amount is ₹1 (100 paise)');
  }

  const razorpay = await getRazorpayInstance();

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    };
  } catch (error: any) {
    throw new RazorpayOrderError(
      `Failed to create Razorpay order: ${error?.message || 'Unknown error'}`
    );
  }
}

// ── Payment Verification ─────────────────────────────────────

/**
 * Verify a Razorpay payment signature using HMAC-SHA256.
 *
 * The signature is computed as:
 *   HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 *
 * This verification happens SERVER-SIDE ONLY.
 * Never trust the frontend success callback alone.
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): RazorpayVerificationResult {
  const { keySecret } = getConfig();

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(body)
    .digest('hex');

  const verified = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(razorpaySignature, 'hex'),
  );

  return {
    verified,
    paymentId: razorpayPaymentId,
    orderId: razorpayOrderId,
  };
}

// ── Status Polling ───────────────────────────────────────────

/**
 * Fetch the current status of a Razorpay order.
 * Used for polling when no callback is received.
 */
export async function fetchOrderStatus(orderId: string): Promise<{
  status: string;
  amountPaid: number;
  attempts: number;
}> {
  const razorpay = await getRazorpayInstance();

  try {
    const order = await razorpay.orders.fetch(orderId);
    return {
      status: order.status,       // 'created' | 'attempted' | 'paid'
      amountPaid: order.amount_paid,
      attempts: order.attempts,
    };
  } catch (error: any) {
    throw new RazorpayOrderError(
      `Failed to fetch order status: ${error?.message || 'Unknown error'}`
    );
  }
}

/**
 * Reset the cached instance (for testing).
 */
export function _resetInstance() {
  razorpayInstance = null;
}
