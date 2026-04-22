import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

async function verifyAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get('asmita_auth')?.value;
    if (!token) return false;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.role === 'Super Admin' || decoded.role === 'Admin';
    } catch (e) {
        return false;
    }
}

export async function GET() {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
        }

        const db = await getDbConnection();
        const [users] = await db.query(
            `SELECT id, name, email, phone, role, status, department, is_temporary, created_at 
             FROM users 
             ORDER BY created_at DESC`
        );

        return NextResponse.json({ success: true, users });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const isAdmin = await verifyAdmin();
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
        }

        const body = await req.json();
        const { name, email, phone, password, role, department, status, is_temporary } = body;

        // ME FIX: Updated password requirement check (if applicable, though usually handled by minLength)
        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
        }

        // ME FIX: Backend validation for 8 characters
        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }

        const db = await getDbConnection();

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO users (name, email, phone, password_hash, role, department, status, is_temporary) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                email.toLowerCase(),
                phone || null,
                hashedPassword,
                role || 'Field Executive',
                department || 'Sales',
                status !== undefined ? status : 1,
                is_temporary !== undefined ? is_temporary : 1 
            ]
        );

        return NextResponse.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}