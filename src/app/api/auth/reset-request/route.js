import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function POST(req) {
    const { email } = await req.json();
    const db = await getDbConnection();
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP

    const [result] = await db.execute('UPDATE users SET reset_otp = ? WHERE email = ?', [otp, email]);

    if (result.affectedRows === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // In a real app, send the OTP via Email here. 
    // For now, it's just saved in the DB.
    console.log(`OTP for ${email}: ${otp}`); 

    return NextResponse.json({ success: true });
}