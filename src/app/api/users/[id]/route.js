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

export async function GET(req, { params }) {
    try {
        if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { id } = await params;
        const db = await getDbConnection();

        // ME FIX: Added is_temporary to the selection
        const [users] = await db.query(
            'SELECT id, name, email, phone, role, department, status, is_temporary FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({ success: true, user: users[0] });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req, { params }) {
    try {
        if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { id } = await params;
        const body = await req.json();

        // ME FIX: Destructure is_temporary from the body
        const { name, email, phone, password, role, department, status, is_temporary } = body;

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
        }

        const db = await getDbConnection();

        const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
        if (existing.length > 0) {
            return NextResponse.json({ error: 'Email is already in use by another account' }, { status: 409 });
        }

        // Logic: If admin provides a new password, we force is_temporary to 1 
        // unless they explicitly sent a different value for is_temporary.
        let targetTempStatus = is_temporary !== undefined ? is_temporary : 0;

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);

            // If admin is changing the password, usually we want to force the user to change it again
            const finalTempStatus = is_temporary !== undefined ? is_temporary : 1;

            await db.query(
                `UPDATE users SET name=?, email=?, phone=?, password_hash=?, role=?, department=?, status=?, is_temporary=? WHERE id=?`,
                [name, email.toLowerCase(), phone || null, hashedPassword, role, department, status, finalTempStatus, id]
            );
        } else {
            await db.query(
                `UPDATE users SET name=?, email=?, phone=?, role=?, department=?, status=?, is_temporary=? WHERE id=?`,
                [name, email.toLowerCase(), phone || null, role, department, status, targetTempStatus, id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { id } = await params;
        const db = await getDbConnection();

        const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}