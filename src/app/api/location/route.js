import { NextResponse } from 'next/server';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        // ME FIX: Strictly using the secure server-side API key
        const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'Server API key missing' }, { status: 500 });
        }

        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=locality:Mira+Bhayandar&key=${apiKey}`;
        
        const response = await fetch(googleUrl);
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Geocoding API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
    }
}