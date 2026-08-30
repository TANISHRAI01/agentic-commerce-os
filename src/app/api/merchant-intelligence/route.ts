import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';
import { getOrCreateCatalogMerchant } from '@/services/merchant-catalog';
import { generateGrowthReport } from '@/services/growth-intelligence';

/**
 * GET /api/merchant-intelligence
 *
 * Returns growth intelligence signals derived from catalog and transaction data.
 * All data is scoped to the logged-in merchant's catalog.
 *
 * Used by the Merchant Dashboard UI.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    
    let merchantCatalogId: string;
    try {
      merchantCatalogId = getOrCreateCatalogMerchant(db, session.userId);
    } catch (e) {
      return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });
    }

    const report = generateGrowthReport(db, merchantCatalogId);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Merchant intelligence error:', error);
    return NextResponse.json(
      { error: 'Failed to generate growth intelligence report' },
      { status: 500 },
    );
  }
}
