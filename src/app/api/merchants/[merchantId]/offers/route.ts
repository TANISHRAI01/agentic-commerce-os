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
    
    // In a real system, we'd query an offers table or engine based on businessRules.
    // For now, we mock some generic offers returned by the merchant API.
    const offers = [
      { id: 'FESTIVE10', description: '10% off on all items during festive season' },
      { id: 'BANK_5', description: '5% instant discount with selected bank cards' },
    ];
    
    return NextResponse.json({ success: true, offers });
  } catch (error) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}
