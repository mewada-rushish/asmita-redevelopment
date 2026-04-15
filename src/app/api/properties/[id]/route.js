import { getDbConnection } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  let db;
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No ID provided" }, { status: 400 });

    db = await getDbConnection();
    const [rows] = await db.execute('SELECT * FROM properties WHERE id = ?', [id]);

    if (rows.length === 0) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('SERVER-SIDE API ERROR:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  let db;
  try {
    const { id } = await params;
    const data = await req.json();
    db = await getDbConnection();

    const query = `
            UPDATE properties SET 
                category = ?, status = ?, property_name = ?, address = ?, 
                locality = ?, lat = ?, lng = ?, details = ?, committee = ?, checklist = ?
            WHERE id = ?
        `;

    const values = [
      data.category,
      data.status,
      data.propertyName,
      data.address,
      data.locality,
      data.lat,
      data.lng,
      // ME FIX: details and checklist now contain labeled objects from frontend payload
      JSON.stringify(data.details || {}),
      JSON.stringify(data.committeeMembers || []),
      JSON.stringify(data.checklist || []),
      id
    ];

    await db.execute(query, values);
    return NextResponse.json({ success: true, message: "Property updated successfully" });
  } catch (error) {
    console.error('UPDATE ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}