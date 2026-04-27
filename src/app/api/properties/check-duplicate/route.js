import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getSimilarity } from '@/utils/stringSimilarity';

export async function POST(req) {
    try {
        const { property_name, address, excludeId } = await req.json();

        if (!property_name && (!address || address.length < 5)) {
            return NextResponse.json({ isDuplicate: false });
        }

        const db = await getDbConnection();

        const [rows] = await db.execute(
            `SELECT id, property_name, address FROM properties ${excludeId ? 'WHERE id != ?' : ''}`,
            excludeId ? [excludeId] : []
        );

        let highestMatch = {
            similarity: 0,
            property: null
        };

        for (const row of rows) {
            let nameSim = 0;
            let addrSim = 0;

            if (property_name && row.property_name) {
                nameSim = getSimilarity(property_name, row.property_name);
            }

            if (address && row.address) {
                addrSim = getSimilarity(address, row.address);
            }

            const currentMax = Math.max(nameSim, addrSim);

            if (currentMax > highestMatch.similarity) {
                highestMatch = {
                    similarity: currentMax,
                    property: row
                };
            }

            if (highestMatch.similarity === 1) break;
        }

        if (highestMatch.similarity >= 0.95) {
            return NextResponse.json({
                isDuplicate: true,
                similarity: highestMatch.similarity,
                matchedProperty: highestMatch.property
            });
        }

        return NextResponse.json({ isDuplicate: false });

    } catch (error) {
        console.error('ERROR [check-duplicate]:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}