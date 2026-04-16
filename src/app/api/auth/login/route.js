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
    // ME FIX: Added is_temporary to the SELECT query
    const [rows] = await db.query('SELECT id, name, email, password_hash, role, is_temporary FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    // --- ME FIX: TEMPORARY PASSWORD CHECK ---
    // If this flag is 1, we stop the login process and tell the frontend to force a change.
    if (user.is_temporary === 1) {
      return NextResponse.json({ 
        requiresPasswordChange: true, 
        email: user.email 
      });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secret_asmita_erp_2026', 
      { expiresIn: '1d' }
    );

    const cookieStore = await cookies(); 
    
    cookieStore.set('asmita_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
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