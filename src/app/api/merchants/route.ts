import { NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getAllMerchants } from '@/services/catalog';

export async function GET() {
  try {
    const db = await getDb();
    const merchants = getAllMerchants(db);
    return NextResponse.json({ success: true, merchants });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch merchants' },
      { status: 500 }
    );
  }
}
