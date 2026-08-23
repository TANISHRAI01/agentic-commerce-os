// ============================================================
// PaymentSimulator — Deterministic test abstraction
// Controls payment provider behavior for development/testing.
//
// ⚠️  DEV/TEST ONLY. Never enabled in production.
// Controlled via PAYMENT_SIM_MODE environment variable.
// ============================================================

export type SimulatorMode =
  | 'NORMAL'               // Pass-through to real Razorpay
  | 'TIMEOUT_THEN_SUCCESS' // Order created; polling returns 'paid'
  | 'TIMEOUT_THEN_FAILURE' // Order created; polling returns 'attempted' (never paid)
  | 'VERIFICATION_ERROR';  // Polling throws a network error

export interface SimulatedOrderStatus {
  status: 'created' | 'attempted' | 'paid';
  amountPaid: number;
  attempts: number;
}

// ── Guard: never activate in production ─────────────────────

function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[PaymentSimulator] CRITICAL: Simulator must never run in production. ' +
      'Unset PAYMENT_SIM_MODE before deploying.',
    );
  }
}

// ── Active mode ──────────────────────────────────────────────

export function getSimulatorMode(): SimulatorMode | null {
  const raw = process.env.PAYMENT_SIM_MODE;
  if (!raw || raw === '' || raw === 'NORMAL') return null; // null = real Razorpay
  assertNotProduction();

  const valid: SimulatorMode[] = [
    'NORMAL',
    'TIMEOUT_THEN_SUCCESS',
    'TIMEOUT_THEN_FAILURE',
    'VERIFICATION_ERROR',
  ];

  if (!valid.includes(raw as SimulatorMode)) {
    throw new Error(
      `[PaymentSimulator] Unknown PAYMENT_SIM_MODE: "${raw}". ` +
      `Valid modes: ${valid.join(', ')}`,
    );
  }

  return raw as SimulatorMode;
}

export function isSimulatorActive(): boolean {
  return getSimulatorMode() !== null;
}

// ── Simulated order creation ─────────────────────────────────

export interface SimulatedOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
}

export async function simulateCreateOrder(
  amountInPaise: number,
  currency: string,
  receipt: string,
): Promise<SimulatedOrderResult> {
  assertNotProduction();
  return {
    orderId: `order_SIM_${receipt.slice(-8)}_${Date.now()}`,
    amount: amountInPaise,
    currency,
    receipt,
  };
}

// ── Simulated order status polling ───────────────────────────

/**
 * Returns a deterministic status based on the active PAYMENT_SIM_MODE.
 *
 * TIMEOUT_THEN_SUCCESS → 'paid'     (recovery succeeds)
 * TIMEOUT_THEN_FAILURE → 'attempted' (recovery marks as failed)
 * VERIFICATION_ERROR   → throws     (recovery stays UNKNOWN)
 */
export async function simulateFetchOrderStatus(
  orderId: string,
): Promise<SimulatedOrderStatus> {
  assertNotProduction();
  const mode = getSimulatorMode();

  switch (mode) {
    case 'TIMEOUT_THEN_SUCCESS':
      return { status: 'paid', amountPaid: 100000, attempts: 1 };

    case 'TIMEOUT_THEN_FAILURE':
      return { status: 'attempted', amountPaid: 0, attempts: 1 };

    case 'VERIFICATION_ERROR':
      throw new Error(`[PaymentSimulator] Simulated network error fetching status for ${orderId}`);

    default:
      // NORMAL — caller should be using real Razorpay
      throw new Error('[PaymentSimulator] simulateFetchOrderStatus called in NORMAL mode');
  }
}
