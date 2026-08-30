// GET /api/auth/me
import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  getUserById,
  getCustomerProfile,
  getMerchantProfile,
  SESSION_COOKIE_NAME,
} from '@/services/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const session = verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    let profile = null;
    if (user.role === 'CUSTOMER') {
      profile = await getCustomerProfile(user.id);
    } else {
      profile = await getMerchantProfile(user.id);
    }

    return NextResponse.json({ user, profile });
  } catch (err) {
    console.error('[/api/auth/me] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
