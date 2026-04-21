import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDbConnection();
        const [tables] = await db.query("SHOW TABLES");
        const schema = {};

        for (const tableObj of tables) {
            // Extract the table name dynamically
            const tableName = Object.values(tableObj)[0];

            // Describe the table to get column info
            const [columns] = await db.query(`DESCRIBE ??`, [tableName]);

            // Map it down to just the Field and Type
            schema[tableName] = columns.map(col => ({
                field: col.Field,
                type: col.Type
            }));
        }

        return NextResponse.json({ success: true, schema });
    } catch (error) {
        console.error("Schema API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}