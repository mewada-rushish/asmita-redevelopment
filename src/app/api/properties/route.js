import { getDbConnection } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  let db;
  try {
    db = await getDbConnection();
    const [rows] = await db.execute('SELECT * FROM properties ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('API_GET_ERROR:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (db && db.end) await db.end();
  }
}

export async function POST(req) {
  let db;
  try {
    const data = await req.json();
    db = await getDbConnection();

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
      JSON.stringify(data.details || {}),
      JSON.stringify(data.committeeMembers || []), 
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (db && db.end) await db.end();
  }
}


export async function PATCH(req) {
  let db;
  try {
    const { id, status } = await req.json();
    
    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Missing ID or Status' }, { status: 400 });
    }

    db = await getDbConnection();
    
    // Using a targeted query for performance
    const query = `UPDATE properties SET status = ? WHERE id = ?`;
    await db.execute(query, [status, id]);

    return NextResponse.json({ 
      success: true, 
      message: `Property ${id} status updated to ${status}` 
    });

  } catch (error) {
    console.error('API_PATCH_ERROR:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (db && db.end) await db.end();
  }
}