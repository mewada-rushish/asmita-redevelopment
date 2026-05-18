import { getDbConnection } from '@/lib/db';
import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

/**
 * Verify authentication and extract user data
 */
async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('asmita_auth')?.value;
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = await getDbConnection();
    const [rows] = await db.execute('SELECT role, name, email FROM users WHERE id = ? LIMIT 1', [decoded.id]);

    if (rows.length === 0) return false;
    return decoded;
  } catch (e) {
    return false;
  }
}

/**
 * GET /api/partners
 * Fetches the list of Channel Partners and their linked properties from the database.
 */
export async function GET() {
  try {
    // 1. Verify User Session (Optional but recommended for security)
    const auth = await verifyAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDbConnection();

    // 2. Fetch all Channel Partners and Field Executives
    const [partners] = await db.execute(`
      SELECT id, name, email, phone AS contact, status, department 
      FROM users 
      WHERE role IN ('CP', 'Channel Partner', 'Field Executive')
      ORDER BY name ASC
    `);

    if (partners.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    // 3. Fetch all properties linked to these partners
    const cpIds = partners.map(p => p.id);
    const placeholders = cpIds.map(() => '?').join(',');
    
    // Removed 'category' as it does not exist in the actual properties table
    const [properties] = await db.execute(`
      SELECT id, property_name, locality, address, status, assigned_cp_id
      FROM properties
      WHERE assigned_cp_id IN (${placeholders})
    `, cpIds);

    // 4. Map properties into their respective partner objects
    const formattedPartners = partners.map(cp => {
      const linkedProps = properties
        .filter(p => p.assigned_cp_id === cp.id)
        .map(p => ({
          id: p.id,
          name: p.property_name || 'Unnamed Property',
          locality: p.locality || p.address || 'Location N/A',
          type: 'Redevelopment' // Hardcoded since table doesn't have category/type column
        }));

      // Determine boolean status (status in users table is tinyint(1))
      const isActive = cp.status === 1 || cp.status === 'Active' || cp.status === '1';

      return {
        // Formats ID as CP-0012 for the frontend view
        id: `CP-${cp.id.toString().padStart(4, '0')}`, 
        raw_id: cp.id,
        name: cp.name || 'Unknown User',
        company: cp.department || 'AsmitA India Realty',
        contact: cp.contact || cp.email || 'N/A',
        status: isActive ? 'Active' : 'Inactive',
        properties: linkedProps
      };
    });

    return NextResponse.json({ success: true, data: formattedPartners }, { status: 200 });
  } catch (error) {
    console.error("Error fetching partners:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch partners" }, { status: 500 });
  }
}