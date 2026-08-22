import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getAuditTrail, buildTimeline } from '@/audit/logger';

/**
 * GET /api/audit — Retrieve audit trail for a transaction
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Missing required param: transactionId' },
        { status: 400 },
      );
    }

    const db = await getDb();
    const events = getAuditTrail(db, transactionId);
    const timeline = buildTimeline(events);

    return NextResponse.json({
      success: true,
      transactionId,
      events,
      timeline,
      count: events.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
