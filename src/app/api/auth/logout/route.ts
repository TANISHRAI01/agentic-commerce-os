// POST /api/auth/logout
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/services/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });
  return response;
}
