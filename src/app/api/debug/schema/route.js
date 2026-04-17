import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
    let db; // Initialize variable for the connection
    try {
        // ME FIX: Call the function to get the actual database instance
        db = await getDbConnection();

        // 1. Get all table names
        const [tables] = await db.query("SHOW TABLES");
        const schema = {};

        // 2. Describe each table
        for (const tableObj of tables) {
            const tableName = tableObj[Object.keys(tableObj)[0]];
            // ME FIX: Using the instance 'db' to run the query
            const [columns] = await db.query(`DESCRIBE ??`, [tableName]);
            schema[tableName] = columns;
        }

        return NextResponse.json({ success: true, schema });
    } catch (error) {
        console.error("Schema Debug Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}