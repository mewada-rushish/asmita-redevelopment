import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Helper to securely get the logged-in user from the HTTP-only cookie
async function getAuthUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('asmita_auth')?.value;
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return null;
    }
}

export async function GET() {
    try {
        const userToken = await getAuthUser();
        if (!userToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDbConnection();
        // Look up by email (since it's unique and standard in JWTs) or ID
        const [users] = await db.execute(
            'SELECT id, name, email, phone, role, department FROM users WHERE email = ? OR id = ? LIMIT 1',
            [userToken.email || '', userToken.id || 0]
        );

        if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('PROFILE_GET_ERROR:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req) {
    try {
        const userToken = await getAuthUser();
        if (!userToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        // Destructure the new admin fields as well
        const { name, phone, email, role, department, currentPassword, newPassword } = body;

        const db = await getDbConnection();

        // Fetch the user's role to securely verify admin privileges on the server side
        const [users] = await db.execute(
            'SELECT id, password_hash, role FROM users WHERE email = ? OR id = ? LIMIT 1',
            [userToken.email || '', userToken.id || 0]
        );

        if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const dbUser = users[0];

        // 1. Handle Info Update
        if (name) {
            const isSuperAdmin = dbUser.role === 'Super Admin' || dbUser.role === 'Admin';

            if (isSuperAdmin && email) {
                // Admins get to update everything
                await db.execute(
                    'UPDATE users SET name = ?, phone = ?, email = ?, role = ?, department = ? WHERE id = ?',
                    [name, phone || null, email, role || dbUser.role, department || null, dbUser.id]
                );
            } else {
                // Regular users only update name and phone
                await db.execute(
                    'UPDATE users SET name = ?, phone = ? WHERE id = ?',
                    [name, phone || null, dbUser.id]
                );
            }
        }

        // 2. Handle Password Update (If requested)
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, dbUser.password_hash);
            if (!isMatch) {
                return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
            }
            if (newPassword.length < 6) {
                return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
            }

            const hashedNew = await bcrypt.hash(newPassword, 10);
            await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNew, dbUser.id]);
        }

        return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('PROFILE_PUT_ERROR:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}