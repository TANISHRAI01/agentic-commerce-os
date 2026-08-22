// ============================================================
// Transaction State Machine
// Enforces valid state transitions for commerce transactions
// ============================================================

import type { TransactionState } from '@/types/schemas';

/**
 * Valid state transitions map.
 * Key = current state, Value = set of allowed next states.
 */
const VALID_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  CREATED:           ['DISCOVERY', 'CANCELLED'],
  DISCOVERY:         ['DECISION', 'CANCELLED'],
  DECISION:          ['CART_READY', 'CANCELLED'],
  CART_READY:        ['POLICY_PENDING', 'CANCELLED'],
  POLICY_PENDING:    ['POLICY_FAIL', 'APPROVAL_REQUIRED', 'AUTO_APPROVED'],
  POLICY_FAIL:       ['BLOCKED'],
  APPROVAL_REQUIRED: ['APPROVED', 'CANCELLED', 'BLOCKED'],
  APPROVED:          ['PAYMENT_PENDING', 'CANCELLED'],
  AUTO_APPROVED:     ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING:   ['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_UNKNOWN'],
  PAYMENT_SUCCESS:   ['VERIFIED'],
  PAYMENT_FAILED:    ['CANCELLED'],
  PAYMENT_UNKNOWN:   ['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'CANCELLED'],
  VERIFIED:          ['COMPLETED'],
  COMPLETED:         [],  // Terminal state
  CANCELLED:         [],  // Terminal state
  BLOCKED:           [],  // Terminal state
};

/**
 * Terminal states — transactions in these states cannot transition further.
 */
export const TERMINAL_STATES: ReadonlySet<TransactionState> = new Set([
  'COMPLETED',
  'CANCELLED',
  'BLOCKED',
]);

/**
 * Check if a state transition is valid.
 */
export function isValidTransition(
  from: TransactionState,
  to: TransactionState,
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Attempt a state transition. Returns the new state if valid,
 * throws an error if the transition is not allowed.
 */
export function transition(
  from: TransactionState,
  to: TransactionState,
): TransactionState {
  if (!isValidTransition(from, to)) {
    throw new StateMachineError(
      `Invalid state transition: ${from} → ${to}. ` +
      `Allowed transitions from ${from}: [${(VALID_TRANSITIONS[from] || []).join(', ')}]`
    );
  }
  return to;
}

/**
 * Get all valid next states from a given state.
 */
export function getValidNextStates(state: TransactionState): TransactionState[] {
  return VALID_TRANSITIONS[state] || [];
}

/**
 * Check if a state is terminal (no further transitions possible).
 */
export function isTerminalState(state: TransactionState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Custom error for state machine violations.
 */
export class StateMachineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateMachineError';
  }
}

/**
 * Get the full valid transitions map (for documentation/debugging).
 */
export function getTransitionsMap(): Record<TransactionState, TransactionState[]> {
  return { ...VALID_TRANSITIONS };
}
