import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { searchProducts } from '@/services/catalog';

export async function GET(
  req: NextRequest,
  { params }: { params: { merchantId: string } }
) {
  try {
    const db = await getDb();
    const products = searchProducts(db, { merchantId: params.merchantId, limit: 100 });
    return NextResponse.json({ success: true, catalog: products });
  } catch (error) {
    console.error('Error fetching merchant catalog:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch merchant catalog' },
      { status: 500 }
    );
  }
}
