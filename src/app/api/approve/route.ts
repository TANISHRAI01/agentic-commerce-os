import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/approve — Record user approval/rejection
 * Phase 3 will implement the full approval flow.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: 'Approval flow will be implemented in Phase 3',
      stub: true,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
