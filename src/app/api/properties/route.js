import { getDbConnection } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('asmita_auth')?.value;
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_asmita_erp_2026');
    return decoded; // Returns user info if valid
  } catch (e) {
    return false;
  }
}

export async function GET() {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const db = await getDbConnection();
    const [rows] = await db.execute('SELECT * FROM properties ORDER BY created_at DESC');

    return NextResponse.json(rows);
  } catch (error) {
    console.error('API_GET_ERROR:', error.message);
    return NextResponse.json({ success: false, error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const data = await req.json();
    const db = await getDbConnection();

    const query = `
            INSERT INTO properties (
                category, status, property_name, address, locality, lat, lng, details, committee, checklist
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const values = [
      data.category || 'Redevelopment',
      data.status || 'Not Approached',
      data.propertyName || 'Unnamed Property',
      data.address || '',
      data.locality || '',
      data.lat || 19.2813,
      data.lng || 72.8693,
      // These objects now contain your labeled checklists (Legal & Survey)
      JSON.stringify(data.details || {}),
      // The committee list
      JSON.stringify(data.committeeMembers || []),
      // This now contains the labeled Section 13 checklist
      JSON.stringify(data.checklist || [])
    ];

    const [result] = await db.execute(query, values);

    return NextResponse.json({
      success: true,
      id: result.insertId,
      message: 'Property successfully added'
    });

  } catch (error) {
    console.error('API_POST_ERROR:', error.message);
    return NextResponse.json({ success: false, error: 'Database insertion failed' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Missing ID or Status' }, { status: 400 });
    }

    const db = await getDbConnection();
    const query = `UPDATE properties SET status = ? WHERE id = ?`;
    await db.execute(query, [status, id]);

    return NextResponse.json({
      success: true,
      message: `Property ${id} status updated to ${status}`
    });

  } catch (error) {
    console.error('API_PATCH_ERROR:', error.message);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}