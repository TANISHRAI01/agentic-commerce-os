// ============================================================
// GET /api/payment/audit — Fetch audit trail for a transaction
// Used by IncidentTimeline to render the event history.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getAuditTrail } from '@/audit/logger';
import { getTransaction } from '@/services/transaction';

/**
 * GET /api/payment/audit?transactionId=xxx
 *
 * Returns all audit events for a transaction, ordered chronologically.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get('transactionId');

  if (!transactionId) {
    return NextResponse.json(
      { error: 'Missing required param: transactionId' },
      { status: 400 },
    );
  }

  const db = await getDb();

  const txn = getTransaction(db, transactionId);
  if (!txn) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 },
    );
  }

  const events = getAuditTrail(db, transactionId);

  return NextResponse.json({
    success: true,
    transactionId,
    transactionState: txn.state,
    eventCount: events.length,
    events,
  });
}
