import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req) {
    const { email, otp, newPassword } = await req.json();
    const db = await getDbConnection();

    const [users] = await db.execute('SELECT id FROM users WHERE email = ? AND reset_otp = ?', [email, otp]);

    if (users.length === 0) {
        return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ?, reset_otp = NULL WHERE email = ?', [hashedPassword, email]);

    return NextResponse.json({ success: true });
}