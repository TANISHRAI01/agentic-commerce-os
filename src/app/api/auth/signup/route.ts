// POST /api/auth/signup
import { NextRequest, NextResponse } from 'next/server';
import { SignupRequestSchema } from '@/types/auth';
import { signupUser, createSessionToken, SESSION_COOKIE_NAME, AuthError } from '@/services/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SignupRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const user = await signupUser(parsed.data);
    const token = createSessionToken(user);

    const response = NextResponse.json({ user }, { status: 201 });
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
      const status = err.code === 'EMAIL_TAKEN' ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('[/api/auth/signup] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
