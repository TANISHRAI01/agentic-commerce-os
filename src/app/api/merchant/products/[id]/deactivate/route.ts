import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';
import {
  deactivateMerchantProduct,
  MerchantCatalogError,
} from '@/services/merchant-catalog';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  return token ? verifySessionToken(token) : null;
}

/**
 * POST /api/merchant/products/[id]/deactivate
 * Sets stock=0 and availability=OUT_OF_STOCK.
 * The product remains in the DB but is no longer discoverable by the AI Buyer.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();

    deactivateMerchantProduct(db, session.userId, id);

    return NextResponse.json({ success: true, productId: id, message: 'Product deactivated' });
  } catch (error) {
    if (error instanceof MerchantCatalogError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 403;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[merchant/products/[id]/deactivate]', error);
    return NextResponse.json({ error: 'Failed to deactivate product' }, { status: 500 });
  }
}
