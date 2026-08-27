// ============================================================
// Transaction Service — CRUD + state machine integration
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { Database as SqlJsDatabase } from 'sql.js';
import type { Transaction, TransactionState, PolicyResult } from '@/types/schemas';
import { transition } from '@/engine/state-machine';
import { createAuditEvent } from '@/audit/logger';
import { saveDb } from '@/db/connection';

/**
 * Create a new transaction.
 */
export function createTransaction(
  db: SqlJsDatabase,
  params?: { intentRaw?: string; intentId?: string; idempotencyKey?: string },
): Transaction {
  if (params?.idempotencyKey) {
    const existing = getTransactionByIdempotencyKey(db, params.idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  const now = new Date().toISOString();
  const txn: Transaction = {
    id: uuidv4(),
    state: 'CREATED',
    intentId: params?.intentId,
    intentRaw: params?.intentRaw,
    idempotencyKey: params?.idempotencyKey || uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO transactions (id, state, intent_id, intent_raw, idempotency_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [txn.id, txn.state, txn.intentId ?? null, txn.intentRaw ?? null, txn.idempotencyKey, txn.createdAt, txn.updatedAt],
  );

  createAuditEvent(db, {
    transactionId: txn.id,
    event: 'STATE_TRANSITION',
    result: 'INFO',
    reason: `Transaction created with state CREATED`,
    metadata: { idempotencyKey: txn.idempotencyKey },
  });

  saveDb();

  return txn;
}

/**
 * Transition a transaction to a new state.
 * Validates the transition via the state machine.
 */
export function transitionTransaction(
  db: SqlJsDatabase,
  transactionId: string,
  newState: TransactionState,
  updates?: Partial<Pick<Transaction,
    'selectedProductId' | 'selectedProductName' | 'selectedProductPrice' |
    'policyResult' | 'approvalStatus' | 'razorpayOrderId' | 'razorpayPaymentId' |
    'failureReason' | 'intentId' | 'negotiatedPrice' | 'negotiationRounds' | 'negotiationLog'
  >>,
): Transaction {
  const txn = getTransaction(db, transactionId);
  if (!txn) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  // Validate state transition
  const validatedState = transition(txn.state, newState);

  const now = new Date().toISOString();

  // Build SET clause dynamically
  const setClauses: string[] = ['state = ?', 'updated_at = ?'];
  const values: (string | number | null)[] = [validatedState, now];

  if (updates?.selectedProductId !== undefined) {
    setClauses.push('selected_product_id = ?');
    values.push(updates.selectedProductId);
  }
  if (updates?.selectedProductName !== undefined) {
    setClauses.push('selected_product_name = ?');
    values.push(updates.selectedProductName);
  }
  if (updates?.selectedProductPrice !== undefined) {
    setClauses.push('selected_product_price = ?');
    values.push(updates.selectedProductPrice);
  }
  if (updates?.policyResult !== undefined) {
    setClauses.push('policy_result = ?');
    values.push(JSON.stringify(updates.policyResult));
  }
  if (updates?.approvalStatus !== undefined) {
    setClauses.push('approval_status = ?');
    values.push(updates.approvalStatus);
  }
  if (updates?.razorpayOrderId !== undefined) {
    setClauses.push('razorpay_order_id = ?');
    values.push(updates.razorpayOrderId);
  }
  if (updates?.razorpayPaymentId !== undefined) {
    setClauses.push('razorpay_payment_id = ?');
    values.push(updates.razorpayPaymentId);
  }
  if (updates?.failureReason !== undefined) {
    setClauses.push('failure_reason = ?');
    values.push(updates.failureReason);
  }
  if (updates?.intentId !== undefined) {
    setClauses.push('intent_id = ?');
    values.push(updates.intentId);
  }
  if (updates?.negotiatedPrice !== undefined) {
    setClauses.push('negotiated_price = ?');
    values.push(updates.negotiatedPrice);
  }
  if (updates?.negotiationRounds !== undefined) {
    setClauses.push('negotiation_rounds = ?');
    values.push(updates.negotiationRounds);
  }
  if (updates?.negotiationLog !== undefined) {
    setClauses.push('negotiation_log = ?');
    values.push(updates.negotiationLog);
  }

  values.push(transactionId, txn.state);

  db.run(
    `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ? AND state = ?`,
    values,
  );

  if (db.getRowsModified() === 0) {
    throw new Error(`Concurrent modification: Transaction ${transactionId} is no longer in state ${txn.state}`);
  }

  createAuditEvent(db, {
    transactionId,
    event: 'STATE_TRANSITION',
    result: 'SUCCESS',
    reason: `Transaction state: ${txn.state} → ${validatedState}`,
    metadata: { from: txn.state, to: validatedState, ...updates },
  });

  saveDb();

  return getTransaction(db, transactionId)!;
}

/**
 * Get a transaction by ID.
 */
export function getTransaction(
  db: SqlJsDatabase,
  transactionId: string,
): Transaction | null {
  const stmt = db.prepare(
    `SELECT id, state, intent_id, intent_raw, selected_product_id,
            selected_product_name, selected_product_price,
            negotiated_price, negotiation_rounds, negotiation_log,
            policy_result, approval_status, razorpay_order_id, razorpay_payment_id,
            idempotency_key, failure_reason, created_at, updated_at
     FROM transactions WHERE id = ?`,
  );
  stmt.bind([transactionId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();

  return rowToTransaction(row);
}

/**
 * Get a transaction by idempotency key.
 */
export function getTransactionByIdempotencyKey(
  db: SqlJsDatabase,
  idempotencyKey: string,
): Transaction | null {
  const stmt = db.prepare(
    `SELECT id, state, intent_id, intent_raw, selected_product_id,
            selected_product_name, selected_product_price,
            negotiated_price, negotiation_rounds, negotiation_log,
            policy_result, approval_status, razorpay_order_id, razorpay_payment_id,
            idempotency_key, failure_reason, created_at, updated_at
     FROM transactions WHERE idempotency_key = ?`,
  );
  stmt.bind([idempotencyKey]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();

  return rowToTransaction(row);
}

// ── Helpers ──────────────────────────────────────────────────

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    state: row.state as TransactionState,
    intentId: (row.intent_id as string) || undefined,
    intentRaw: (row.intent_raw as string) || undefined,
    selectedProductId: (row.selected_product_id as string) || undefined,
    selectedProductName: (row.selected_product_name as string) || undefined,
    selectedProductPrice: row.selected_product_price as number | undefined,
    negotiatedPrice: row.negotiated_price as number | undefined,
    negotiationRounds: row.negotiation_rounds as number | undefined,
    negotiationLog: (row.negotiation_log as string) || undefined,
    policyResult: row.policy_result ? JSON.parse(row.policy_result as string) as PolicyResult : undefined,
    approvalStatus: (row.approval_status as Transaction['approvalStatus']) || undefined,
    razorpayOrderId: (row.razorpay_order_id as string) || undefined,
    razorpayPaymentId: (row.razorpay_payment_id as string) || undefined,
    idempotencyKey: row.idempotency_key as string,
    failureReason: (row.failure_reason as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
