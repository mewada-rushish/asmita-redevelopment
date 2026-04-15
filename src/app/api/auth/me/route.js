import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('asmita_auth')?.value;

        if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

        // Decode the token to get role and name
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_asmita_erp_2026');

        return NextResponse.json({
            name: decoded.name || 'User',
            role: decoded.role,
            email: decoded.email
        });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
}