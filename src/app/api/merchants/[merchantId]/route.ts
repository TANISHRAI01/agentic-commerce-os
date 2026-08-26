import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getMerchantById } from '@/services/catalog';

export async function GET(
  req: NextRequest,
  { params }: { params: { merchantId: string } }
) {
  try {
    const db = await getDb();
    const merchant = getMerchantById(db, params.merchantId);
    if (!merchant) {
      return NextResponse.json(
        { success: false, error: 'Merchant not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, merchant });
  } catch (error) {
    console.error('Error fetching merchant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch merchant' },
      { status: 500 }
    );
  }
}
