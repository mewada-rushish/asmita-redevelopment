import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getDbConnection } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required!' }, { status: 400 });
    }

    const db = await getDbConnection();
    const [rows] = await db.query('SELECT id, name, email, password_hash, role, is_temporary FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    if (user.is_temporary === 1) {
      return NextResponse.json({
        requiresPasswordChange: true,
        email: user.email
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const cookieStore = await cookies();
    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');

    cookieStore.set('asmita_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: { name: user.name, role: user.role }
    });

  } catch (error) {
    console.error('CRITICAL Login error:', error);
    return NextResponse.json({
      error: 'Internal Server Error'
    }, { status: 500 });
  }
}