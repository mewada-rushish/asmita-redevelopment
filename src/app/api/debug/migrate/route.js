import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
    let db;
    try {
        db = await getDbConnection();
        let backupFileName = null;

        // 1. Check if the table exists to avoid errors if run twice
        const [tables] = await db.query("SHOW TABLES LIKE 'properties'");

        if (tables.length > 0) {
            // 2. Fetch all current data
            const [rows] = await db.query("SELECT * FROM properties");

            if (rows.length > 0) {
                // 3. Convert JSON and text data safely to CSV format
                const headers = Object.keys(rows[0]);
                const csvRows = rows.map(row =>
                    headers.map(header => {
                        let val = row[header];
                        if (val === null || val === undefined) return '';

                        // Convert objects (like the details column) to string
                        if (typeof val === 'object') {
                            val = JSON.stringify(val);
                        }

                        let str = String(val);
                        // Escape quotes, commas, and newlines so CSV doesn't break
                        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                            str = `"${str.replace(/"/g, '""')}"`;
                        }
                        return str;
                    }).join(',')
                );

                const csvContent = [headers.join(','), ...csvRows].join('\n');

                // 4. Save the CSV backup to the /public folder so it can be downloaded
                backupFileName = `properties_backup_${Date.now()}.csv`;
                const backupPath = path.join(process.cwd(), 'public', backupFileName);
                fs.writeFileSync(backupPath, csvContent, 'utf8');
                console.log(`Backup saved to: ${backupPath}`);
            }
        }

        // 5. Drop the old table (Data is now safe in the CSV)
        await db.query("DROP TABLE IF EXISTS properties");

        // 6. Create the new, optimized table based on the Master Schema
        const createTableQuery = `
            CREATE TABLE properties (
                -- 1. System, Assignment & Location
                id INT AUTO_INCREMENT PRIMARY KEY,
                assigned_cp_id INT NULL,
                pmc_name VARCHAR(150) NULL,
                pmc_contact VARCHAR(20) NULL,
                property_name VARCHAR(255) NOT NULL,
                address TEXT NULL,
                locality VARCHAR(100) NULL,
                lat DECIMAL(10,8) NULL,
                lng DECIMAL(11,8) NULL,
                status VARCHAR(50) DEFAULT 'Not Approached',

                -- 2. Core Legal & Society Data
                land_owner_name VARCHAR(255) NULL,
                land_type ENUM('Freehold', 'Leasehold') DEFAULT 'Freehold',
                cts_survey_no VARCHAR(100) NULL,
                is_society_registered TINYINT(1) DEFAULT 0,
                registration_no VARCHAR(100) NULL,
                total_plot_area VARCHAR(100) NULL,
                total_flats INT NULL,
                total_shops INT NULL,
                total_flat_area_combined VARCHAR(100) NULL,

                -- 3. Key Contacts (JSON format: {"name": "", "contact": ""})
                chairman_details JSON NULL,
                secretary_details JSON NULL,
                treasurer_details JSON NULL,
                responsible_person_details JSON NULL,
                extra_committee_members JSON NULL,

                -- 4. Operational & Legal Toggles
                has_approved_plan TINYINT(1) DEFAULT 0,
                has_oc TINYINT(1) DEFAULT 0,
                has_cc TINYINT(1) DEFAULT 0,
                has_legal_dispute TINYINT(1) DEFAULT 0,
                is_mortgaged TINYINT(1) DEFAULT 0,
                has_redevelopment_interest TINYINT(1) DEFAULT 0,
                flat_measure_allowed TINYINT(1) DEFAULT 0,

                -- 5. Survey, Banners & Documents
                physical_survey ENUM('Not Started', 'In Progress', 'Completed') DEFAULT 'Not Started',
                physical_survey_records TEXT NULL,
                banner_permission_allowed TINYINT(1) DEFAULT 0,
                hoarding_date DATE NULL,
                document_checklist JSON NULL,
                document_remarks TEXT NULL,
                interest_letter_file VARCHAR(255) NULL,
                architect_submitted TINYINT(1) DEFAULT 0,

                -- 6. Interaction & Milestones
                interaction_history TEXT NULL,
                offer_letter_status ENUM('Not Sent', 'Offer Sent', 'Under Negotiation', 'Accepted') DEFAULT 'Not Sent',
                offer_meeting_track TEXT NULL,
                offer_acceptance_date DATE NULL,
                sgm_completed TINYINT(1) DEFAULT 0,
                da_agreement_status ENUM('Not Started', 'In Process', 'Completed') DEFAULT 'Not Started',

                -- Timestamps
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                -- Foreign Key Constraint (Assuming users table has an 'id' column)
                FOREIGN KEY (assigned_cp_id) REFERENCES users(id) ON DELETE SET NULL
            );
        `;

        await db.query(createTableQuery);

        return NextResponse.json({
            success: true,
            message: "Success! The properties table has been rebuilt.",
            backup_url: backupFileName ? `/${backupFileName}` : "No previous data to backup."
        });

    } catch (error) {
        console.error("Migration Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}