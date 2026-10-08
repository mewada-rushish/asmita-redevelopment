import { getDbConnection } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = await getDbConnection();
    const [rows] = await db.execute('SELECT * FROM property_groups WHERE id = ?', [id]);
    if (rows.length === 0) {
      return new Response(JSON.stringify(null), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(rows[0]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error fetching property group:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, territory, status } = body;
    
    const db = await getDbConnection();
    
    // Upsert logic
    const [existing] = await db.execute('SELECT id FROM property_groups WHERE id = ?', [id]);
    
    if (existing.length > 0) {
      await db.execute(
        'UPDATE property_groups SET name = ?, territory = ?, status = ? WHERE id = ?',
        [name || null, territory ? JSON.stringify(territory) : null, status || null, id]
      );
    } else {
      await db.execute(
        'INSERT INTO property_groups (id, name, territory, status) VALUES (?, ?, ?, ?)',
        [id, name || null, territory ? JSON.stringify(territory) : null, status || null]
      );
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error saving property group:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
