// ============================================================
// Tests — Audit Event System
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Database as SqlJsDatabase } from 'sql.js';
import { getTestDb } from '@/db/connection';
import {
  createAuditEvent,
  getAuditTrail,
  getAuditEventCount,
  buildTimeline,
} from '@/audit/logger';
import type { AuditEvent } from '@/types/schemas';

let db: SqlJsDatabase;
const TEST_TXN_ID = 'test-txn-001';

beforeAll(async () => {
  db = await getTestDb();

  // Create a transaction for audit events to reference
  db.run(
    `INSERT INTO transactions (id, state, idempotency_key, created_at, updated_at)
     VALUES (?, 'CREATED', ?, datetime('now'), datetime('now'))`,
    [TEST_TXN_ID, 'idem-test-001'],
  );
});

afterAll(() => {
  db.close();
});

describe('Audit Event Creation', () => {
  it('should create an audit event', () => {
    const event = createAuditEvent(db, {
      transactionId: TEST_TXN_ID,
      event: 'INTENT_RECEIVED',
      result: 'SUCCESS',
      reason: 'Shopping intent parsed: headphones under ₹8,000',
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.transactionId).toBe(TEST_TXN_ID);
    expect(event.event).toBe('INTENT_RECEIVED');
    expect(event.result).toBe('SUCCESS');
    expect(event.reason).toContain('headphones');
  });

  it('should create an audit event with metadata', () => {
    const event = createAuditEvent(db, {
      transactionId: TEST_TXN_ID,
      event: 'DISCOVERY_COMPLETE',
      result: 'INFO',
      reason: 'Found 5 matching products',
      metadata: { productsFound: 5, category: 'headphones' },
    });

    expect(event.metadata).toEqual({ productsFound: 5, category: 'headphones' });
  });

  it('should create different result types', () => {
    const warning = createAuditEvent(db, {
      transactionId: TEST_TXN_ID,
      event: 'PAYMENT_TIMEOUT',
      result: 'WARNING',
      reason: 'Payment verification timed out after 30s',
    });
    expect(warning.result).toBe('WARNING');

    const failure = createAuditEvent(db, {
      transactionId: TEST_TXN_ID,
      event: 'PAYMENT_FAILED',
      result: 'FAILURE',
      reason: 'Payment declined by bank',
    });
    expect(failure.result).toBe('FAILURE');
  });
});

describe('Audit Trail Retrieval', () => {
  it('should retrieve all events for a transaction', () => {
    const trail = getAuditTrail(db, TEST_TXN_ID);
    expect(trail.length).toBeGreaterThanOrEqual(4);
  });

  it('should return events in chronological order', () => {
    const trail = getAuditTrail(db, TEST_TXN_ID);
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].timestamp >= trail[i - 1].timestamp).toBe(true);
    }
  });

  it('should return empty array for non-existent transaction', () => {
    const trail = getAuditTrail(db, 'non-existent-txn');
    expect(trail).toEqual([]);
  });

  it('should parse metadata from stored events', () => {
    const trail = getAuditTrail(db, TEST_TXN_ID);
    const eventWithMeta = trail.find(e => e.event === 'DISCOVERY_COMPLETE');
    expect(eventWithMeta).toBeDefined();
    expect(eventWithMeta!.metadata).toEqual({ productsFound: 5, category: 'headphones' });
  });
});

describe('Audit Event Count', () => {
  it('should return correct count', () => {
    const count = getAuditEventCount(db, TEST_TXN_ID);
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('should return 0 for non-existent transaction', () => {
    const count = getAuditEventCount(db, 'non-existent-txn');
    expect(count).toBe(0);
  });
});

describe('Timeline Builder', () => {
  it('should build human-readable timeline', () => {
    const events: AuditEvent[] = [
      { id: '1', timestamp: '2025-01-01T10:00:00Z', transactionId: 't1', event: 'INTENT_RECEIVED', result: 'SUCCESS', reason: 'Intent parsed' },
      { id: '2', timestamp: '2025-01-01T10:00:01Z', transactionId: 't1', event: 'DISCOVERY_COMPLETE', result: 'INFO', reason: 'Found 5 products' },
      { id: '3', timestamp: '2025-01-01T10:00:02Z', transactionId: 't1', event: 'PAYMENT_TIMEOUT', result: 'WARNING', reason: 'Timeout occurred' },
      { id: '4', timestamp: '2025-01-01T10:00:03Z', transactionId: 't1', event: 'PAYMENT_FAILED', result: 'FAILURE', reason: 'Payment failed' },
    ];

    const timeline = buildTimeline(events);
    expect(timeline.length).toBe(4);
    expect(timeline[0]).toContain('✅');
    expect(timeline[0]).toContain('Intent parsed');
    expect(timeline[1]).toContain('ℹ️');
    expect(timeline[2]).toContain('⚠️');
    expect(timeline[3]).toContain('❌');
  });
});
