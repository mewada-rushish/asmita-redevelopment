import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getDbConnection } from '@/lib/db';

const DUMMY_HASH = '$2a$10$x9DkO.iS2aE.Q2B.Z.4QO.yE5y.R.X.x.Q.X.x.Q.X.x.Q.X.x';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    // 1. Validate Input Presence & Length (Prevents DoS)
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required!' }, { status: 400 });
    }
    if (email.length > 255 || password.length > 72) {
      return NextResponse.json({ error: 'Invalid input length' }, { status: 400 });
    }

    const db = await getDbConnection();
    const [rows] = await db.query(
      'SELECT id, name, email, password_hash, role, is_temporary, failed_attempts, locked_until FROM users WHERE email = ?', 
      [email]
    );
    const user = rows[0];

    // 2. Lockout Check (If they are ALREADY locked before this attempt)
    if (user && user.locked_until) {
      const lockTime = new Date(user.locked_until).getTime();
      const now = new Date().getTime();
      if (now < lockTime) {
        const minutesLeft = Math.ceil((lockTime - now) / 60000);
        return NextResponse.json({ error: `Account locked due to multiple failed attempts. Try again in ${minutesLeft} minutes.` }, { status: 429 });
      }
    }

    let isMatch = false;

    // 3. Timing Attack Prevention
    if (user) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      await bcrypt.compare(password, DUMMY_HASH);
    }

    // 4. Failed Login Handler
    if (!user || !isMatch) {
      if (user) {
        let newAttempts = (user.failed_attempts || 0) + 1;
        
        if (newAttempts >= MAX_ATTEMPTS) {
          // Lock the account in DB
          await db.execute(
            'UPDATE users SET failed_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
            [newAttempts, LOCKOUT_MINUTES, user.id]
          );
          
          // ME FIX: Immediately return 429 so the frontend triggers the Lockout UI right now!
          return NextResponse.json({ 
            error: `Account locked due to multiple failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.` 
          }, { status: 429 });
          
        } else {
          // Just increment attempts
          await db.execute('UPDATE users SET failed_attempts = ? WHERE id = ?', [newAttempts, user.id]);
        }
      }
      
      // Standard error for attempts 1-4
      return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
    }

    // 5. Success: Reset Lockouts
    if (user.failed_attempts > 0 || user.locked_until) {
      await db.execute('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
    }

    // 6. Force Password Change Check
    if (user.is_temporary === 1) {
      return NextResponse.json({
        requiresPasswordChange: true,
        email: user.email
      });
    }

    // 7. Generate Token & Cookie
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}