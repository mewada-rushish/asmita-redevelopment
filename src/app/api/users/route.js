import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Reusable function to grab user data without enforcing Admin
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
        // SECURITY: Any logged-in user can read the list (for dropdowns)
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const db = await getDbConnection();
        const [users] = await db.query(
            `SELECT id, name, email, phone, role, status, department, is_temporary, created_at 
             FROM users ORDER BY created_at DESC`
        );

        return NextResponse.json({ success: true, users });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        // SECURITY: Strictly Admins only for user creation
        const user = await getAuthUser();
        if (!user || (user.role !== 'Super Admin' && user.role !== 'Admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { name, email, phone, password, role, department, status, is_temporary } = body;

        if (!name || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        if (password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 });

        const db = await getDbConnection();

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO users (name, email, phone, password_hash, role, department, status, is_temporary) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email.toLowerCase(), phone || null, hashedPassword, role || 'Field Executive', department || 'Sales', status !== undefined ? status : 1, is_temporary !== undefined ? is_temporary : 1]
        );

        return NextResponse.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}