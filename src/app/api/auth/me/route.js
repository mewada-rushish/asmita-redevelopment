import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDbConnection } from '@/lib/db'; 
import jwt from 'jsonwebtoken';

export async function GET() {
    let db;
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('asmita_auth')?.value;

        if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch fresh data from DB instead of relying on the old token payload
        db = await getDbConnection();
        const [rows] = await db.execute(
            'SELECT id, name, role, email FROM users WHERE id = ? LIMIT 1',
            [decoded.id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = rows[0];

        // Create the JSON response object first so we can attach cookies to it if needed
        const response = NextResponse.json({
            name: user.name || 'User',
            role: user.role,
            email: user.email
        });

        if (decoded.role !== user.role) {
            const newToken = jwt.sign(
                { 
                    id: user.id, 
                    role: user.role, 
                    name: user.name, 
                    email: user.email 
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' } 
            );

            // Inject the new cookie into the user's browser invisibly
            response.cookies.set({
                name: 'asmita_auth',
                value: newToken,
                httpOnly: true,
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 7
            });
            
            console.log(`[AUTH] Silently refreshed token for user ${user.id} - Role upgraded to ${user.role}`);
        }

        return response;
    } catch (error) {
        console.error("AUTH_ME_ERROR:", error);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}