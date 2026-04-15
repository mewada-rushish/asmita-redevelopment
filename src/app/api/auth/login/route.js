import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getDbConnection } from '@/lib/db';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    // 1. Check if empty
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required!' }, { status: 400 });
    }

    // 2. Find user in MySQL 
    // ME FIX: Added 'await' before getDbConnection() so we get the actual tool
    const db = await getDbConnection();
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    // 3. Check password with bcrypt math
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    // 4. Make magic JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret_caveman_club_change_this_later', 
      { expiresIn: '1d' }
    );

    // 5. Put token in HttpOnly cookie (Very Safe!)
    cookies().set('asmita_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return NextResponse.json({ success: true, user: { name: user.name, role: user.role } });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server broke!' }, { status: 500 });
  }
}