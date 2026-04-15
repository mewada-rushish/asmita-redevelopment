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
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    // --- SENIOR DEV DEBUGGING ---
    console.log("--- Login Attempt ---");
    console.log("Email:", email);
    
    if (!user) {
      console.log("Result: User NOT found in DB");
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    // Generate fresh hash for console debugging if needed
    const freshHash = await bcrypt.hash(password, 10);
    console.log("PRO-TIP: If login fails, run this SQL to fix your DB:");
    console.log(`UPDATE users SET password_hash = '${freshHash}' WHERE email = '${email}';`);

    const isMatch = await bcrypt.compare(password, user.password_hash);
    // console.log("Password Match Result:", isMatch);

    if (!isMatch) {
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
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
      error: 'Internal Server Error',
      details: error.message
    }, { status: 500 });
  }
}