import { getDbConnection } from '@/lib/db';
import { NextResponse } from 'next/server';

const CHECKLIST_LABELS = [
    "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
    "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
    "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
    "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
];

export async function GET() {
    let db;
    let updatedCount = 0;

    try {
        db = await getDbConnection();

        // 1. Fetch all properties
        const [properties] = await db.execute('SELECT id, details, checklist FROM properties');

        for (const prop of properties) {
            let needsUpdate = false;

            // --- Parse existing data safely ---
            let checklist = [];
            try { checklist = typeof prop.checklist === 'string' ? JSON.parse(prop.checklist) : prop.checklist || []; } catch (e) { }

            let details = {};
            try { details = typeof prop.details === 'string' ? JSON.parse(prop.details) : prop.details || {}; } catch (e) { }

            // --- MIGRATION 1: Main Document Checklist ---
            // Check if the first item is a string (meaning it's the old format)
            if (checklist.length > 0 && typeof checklist[0] === 'string') {
                checklist = CHECKLIST_LABELS.map((label, index) => ({
                    label: label,
                    value: checklist[index] || 'NO'
                }));
                needsUpdate = true;
            }

            // --- MIGRATION 2: Legal & Survey Checklists (inside details) ---
            // If legalChecklist doesn't exist yet, we build it from the flat keys
            if (!details.legalChecklist) {
                details.legalChecklist = [
                    { label: 'Approved Plan', value: details.approvedPlan || 'NO' },
                    { label: 'OC', value: details.oc || 'NO' },
                    { label: 'CC', value: details.cc || 'NO' },
                    { label: 'Legal Dispute', value: details.legalDispute || 'NO' },
                    { label: 'Mortgaged', value: details.mortgaged || 'NO' },
                    { label: 'Redevelopment Interest', value: details.membersInterested || 'NO' }
                ];
                needsUpdate = true;
            }

            if (!details.surveyChecklist) {
                details.surveyChecklist = [
                    { label: 'Physical Survey Allowed', value: details.physicalSurvey || 'NO' },
                    { label: 'Flat Measurement Allowed', value: details.flatMeasure || 'NO' },
                    { label: 'Banner Permission', value: details.bannerPerm || 'NO' }
                ];
                needsUpdate = true;
            }

            // --- Execute Update if data was changed ---
            if (needsUpdate) {
                await db.execute(
                    'UPDATE properties SET checklist = ?, details = ? WHERE id = ?',
                    [JSON.stringify(checklist), JSON.stringify(details), prop.id]
                );
                updatedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration complete. Successfully updated ${updatedCount} properties.`
        });

    } catch (error) {
        console.error('MIGRATION_ERROR:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (db && db.end) await db.end();
    }
}