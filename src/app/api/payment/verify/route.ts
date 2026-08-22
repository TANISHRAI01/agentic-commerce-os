import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payment/verify — Verify a Razorpay payment signature
 * Phase 4 will implement payment verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: 'Payment verification will be implemented in Phase 4',
      stub: true,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
