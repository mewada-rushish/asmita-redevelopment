import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

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
        const { name, phone, email, role, department } = body;

        const db = await getDbConnection();

        // Fetch the user's role and email to securely verify privileges
        const [users] = await db.execute(
            'SELECT id, role, email FROM users WHERE email = ? OR id = ? LIMIT 1',
            [userToken.email || '', userToken.id || 0]
        );

        if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        const dbUser = users[0];

        // Handle Info Update based on strict tier hierarchy
        if (name) {
            if (dbUser.role === 'Super Admin') {
                // Super Admins can update everything, including roles
                await db.execute(
                    'UPDATE users SET name = ?, phone = ?, email = ?, role = ?, department = ? WHERE id = ?',
                    [name, phone || null, email || dbUser.email, role || dbUser.role, department || null, dbUser.id]
                );
            } else if (dbUser.role === 'Admin') {
                // Admins can update their department and email, but CANNOT change their own role
                await db.execute(
                    'UPDATE users SET name = ?, phone = ?, email = ?, department = ? WHERE id = ?',
                    [name, phone || null, email || dbUser.email, department || null, dbUser.id]
                );
            } else {
                // Regular users only update name and phone
                await db.execute(
                    'UPDATE users SET name = ?, phone = ? WHERE id = ?',
                    [name, phone || null, dbUser.id]
                );
            }
        }

        return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('PROFILE_PUT_ERROR:', error);
        // Catch for Duplicate Email errors
        if (error.code === 'ER_DUP_ENTRY') {
             return NextResponse.json({ error: 'That email is already in use by another account.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}