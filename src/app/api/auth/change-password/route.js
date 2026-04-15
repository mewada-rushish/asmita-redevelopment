import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, currentPassword, newPassword } = body;

        if (!email || !currentPassword || !newPassword) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
        }

        const db = await getDbConnection();

        const [users] = await db.query(
            'SELECT id, password_hash FROM users WHERE email = ? AND status = 1',
            [email.toLowerCase().trim()]
        );

        if (users.length === 0) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isMatch) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedNewPassword, user.id]
        );

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}