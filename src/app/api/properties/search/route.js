import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const excludeId = searchParams.get('exclude');

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    try {
        const db = await getDbConnection();

        let sql = `
            SELECT id, property_name, address 
            FROM properties 
            WHERE (property_name LIKE ? OR address LIKE ?)
        `;
        const params = [`%${query}%`, `%${query}%`];

        if (excludeId && excludeId !== 'undefined' && excludeId !== 'null') {
            sql += ` AND id != ?`;
            params.push(excludeId);
        }

        sql += ` LIMIT 10`;

        const [rows] = await db.execute(sql, params);

        return NextResponse.json(rows);
        
    } catch (error) {
        console.error('SERVER_ERROR [property search]:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}