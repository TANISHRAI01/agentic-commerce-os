import { NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { generateGrowthReport } from '@/services/growth-intelligence';

/**
 * GET /api/merchant-intelligence
 *
 * Returns growth intelligence signals derived from catalog and transaction data.
 * All data is synthetic/heuristic. No revenue claims.
 *
 * Used by the Merchant Dashboard UI.
 */
export async function GET() {
  try {
    const db = await getDb();
    const report = generateGrowthReport(db);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Merchant intelligence error:', error);
    return NextResponse.json(
      { error: 'Failed to generate growth intelligence report' },
      { status: 500 },
    );
  }
}
