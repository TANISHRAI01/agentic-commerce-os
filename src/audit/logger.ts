// ============================================================
// Audit Logger — Structured event logging system
// Append-only audit trail for all transaction operations
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { Database as SqlJsDatabase } from 'sql.js';
import type { AuditEvent, AuditEventType } from '@/types/schemas';
import { AuditEventSchema } from '@/types/schemas';
import { saveDb } from '@/db/connection';

/**
 * Create and persist an audit event.
 */
export function createAuditEvent(
  db: SqlJsDatabase,
  params: {
    transactionId: string;
    event: AuditEventType;
    result: 'SUCCESS' | 'FAILURE' | 'INFO' | 'WARNING';
    reason: string;
    metadata?: Record<string, unknown>;
  },
): AuditEvent {
  const auditEvent: AuditEvent = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    transactionId: params.transactionId,
    event: params.event,
    result: params.result,
    reason: params.reason,
    metadata: params.metadata,
  };

  // Validate before persisting
  AuditEventSchema.parse(auditEvent);

  db.run(
    `INSERT INTO audit_events (id, timestamp, transaction_id, event, result, reason, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      auditEvent.id,
      auditEvent.timestamp,
      auditEvent.transactionId,
      auditEvent.event,
      auditEvent.result,
      auditEvent.reason,
      auditEvent.metadata ? JSON.stringify(auditEvent.metadata) : null,
    ],
  );

  saveDb();

  return auditEvent;
}

/**
 * Retrieve all audit events for a transaction, ordered chronologically.
 */
export function getAuditTrail(
  db: SqlJsDatabase,
  transactionId: string,
): AuditEvent[] {
  const stmt = db.prepare(
    `SELECT id, timestamp, transaction_id, event, result, reason, metadata
     FROM audit_events
     WHERE transaction_id = ?
     ORDER BY timestamp ASC`,
  );
  stmt.bind([transactionId]);

  const results: AuditEvent[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      timestamp: string;
      transaction_id: string;
      event: string;
      result: string;
      reason: string;
      metadata: string | null;
    };
    results.push({
      id: row.id,
      timestamp: row.timestamp,
      transactionId: row.transaction_id,
      event: row.event as AuditEvent['event'],
      result: row.result as AuditEvent['result'],
      reason: row.reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    });
  }
  stmt.free();

  return results;
}

/**
 * Get the count of audit events for a transaction.
 */
export function getAuditEventCount(
  db: SqlJsDatabase,
  transactionId: string,
): number {
  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM audit_events WHERE transaction_id = ?`,
  );
  stmt.bind([transactionId]);
  stmt.step();
  const row = stmt.getAsObject() as { count: number };
  stmt.free();
  return row.count;
}

/**
 * Build a human-readable timeline from audit events.
 */
export function buildTimeline(events: AuditEvent[]): string[] {
  return events.map((e) => {
    const time = new Date(e.timestamp).toLocaleTimeString();
    const icon = e.result === 'SUCCESS' ? '✅' :
                 e.result === 'FAILURE' ? '❌' :
                 e.result === 'WARNING' ? '⚠️' : 'ℹ️';
    return `${icon} [${time}] ${e.reason}`;
  });
}
