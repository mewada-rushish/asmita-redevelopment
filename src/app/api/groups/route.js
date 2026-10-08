import { getDbConnection } from '@/lib/db';

export async function GET(request) {
  try {
    const db = await getDbConnection();
    const [rows] = await db.execute('SELECT * FROM property_groups');
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error fetching property groups:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
