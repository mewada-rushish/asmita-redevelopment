import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Dummy hash to prevent timing attacks
const DUMMY_HASH = '$2a$10$x9DkO.iS2aE.Q2B.Z.4QO.yE5y.R.X.x.Q.X.x.Q.X.x.Q.X.x';

export async function POST(req) {
    try {
        const body = await req.json();
        const email = body.email?.trim().toLowerCase();
        const currentPassword = body.currentPassword?.trim();
        const newPassword = body.newPassword?.trim();

        if (!email || !currentPassword || !newPassword) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        // Input length validation (DoS prevention)
        if (email.length > 255 || currentPassword.length > 72 || newPassword.length > 72) {
            return NextResponse.json({ error: 'Invalid input length' }, { status: 400 });
        }

        if (newPassword.length < 8) { // Boosted to 8 characters for enterprise security
            return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
        }

        const db = await getDbConnection();

        // Removed "status = 1" just in case it interferes with locked accounts trying to reset
        const [users] = await db.query(
            'SELECT id, password_hash FROM users WHERE email = ?',
            [email]
        );

        const user = users[0];
        let isMatch = false;

        // --- TIMING ATTACK PREVENTION ---
        if (user) {
            isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        } else {
            // Run compare against dummy hash if user doesn't exist
            await bcrypt.compare(currentPassword, DUMMY_HASH);
        }

        if (!user || !isMatch) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password, clear force-change flag, AND reset any lockout penalties
        await db.query(`
            UPDATE users 
            SET password_hash = ?, 
                is_temporary = 0,
                failed_attempts = 0,
                locked_until = NULL,
                reset_otp = NULL,
                otp_expires_at = NULL
            WHERE id = ?`,
            [hashedNewPassword, user.id]
        );

        return NextResponse.json({ 
            success: true, 
            message: 'Password updated successfully. You can now log in.' 
        });

    } catch (error) {
        console.error('CHANGE_PASSWORD_API_ERROR:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}