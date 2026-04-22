import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDbConnection } from '@/lib/db';

export async function POST(req) {
  try {
    // Now accepting the password typed by the Admin
    const { userId, temporaryPassword } = await req.json();

    if (!userId || !temporaryPassword) {
      return NextResponse.json({ error: 'User ID and temporary password are required' }, { status: 400 });
    }

    if (temporaryPassword.length < 8) {
      return NextResponse.json({ error: 'Temporary password must be at least 8 characters long.' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

    const db = await getDbConnection();

    // Set the Admin's typed password, flag it as temporary, and clear all lockouts
    const [result] = await db.execute(`
      UPDATE users 
      SET password_hash = ?, 
          is_temporary = 1,
          failed_attempts = 0,
          locked_until = NULL,
          reset_otp = NULL,
          otp_expires_at = NULL
      WHERE id = ?
    `, [hashedPassword, userId]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Temporary password assigned successfully.'
    });

  } catch (error) {
    console.error('Admin password reset error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}