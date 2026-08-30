// POST /api/auth/login
import { NextRequest, NextResponse } from 'next/server';
import { LoginRequestSchema } from '@/types/auth';
import { loginUser, createSessionToken, SESSION_COOKIE_NAME, AuthError } from '@/services/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const user = await loginUser(parsed.data.email, parsed.data.password);
    const token = createSessionToken(user);

    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });
    return response;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 401 });
    }
    console.error('[/api/auth/login] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
