import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDbConnection } from '@/lib/db'; // Import your DB connection
import jwt from 'jsonwebtoken';

export async function GET() {
    let db;
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('asmita_auth')?.value;

        if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ME FIX: Fetch fresh data from DB instead of relying on the old token payload
        db = await getDbConnection();
        const [rows] = await db.execute(
            'SELECT name, role, email FROM users WHERE id = ? LIMIT 1',
            [decoded.id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = rows[0];

        return NextResponse.json({
            name: user.name || 'User',
            role: user.role,
            email: user.email
        });
    } catch (error) {
        console.error("AUTH_ME_ERROR:", error);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}