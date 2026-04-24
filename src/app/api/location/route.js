import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function GET(req) {
    try {
        // --- SECURITY: Block public/bot access ---
        const cookieStore = await cookies();
        const token = cookieStore.get('asmita_auth')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized access.' }, { status: 401 });
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return NextResponse.json({ error: 'Invalid session.' }, { status: 403 });
        }
        // -----------------------------------------

        const { searchParams } = new URL(req.url);
        const address = searchParams.get('address');

        if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 });

        const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
        if (!apiKey) return NextResponse.json({ error: 'Server API key missing' }, { status: 500 });

        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=locality:Mira+Bhayandar&key=${apiKey}`;
        
        const response = await fetch(googleUrl);
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Geocoding API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
    }
}