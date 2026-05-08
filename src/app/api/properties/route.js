import { getDbConnection } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { validatePropertyForm } from '@/utils/propertyForm';
import { promoteDraftFiles } from '@/utils/bucketManager';

async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('asmita_auth')?.value;
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = await getDbConnection();
    const [rows] = await db.execute('SELECT role, name, email FROM users WHERE id = ? LIMIT 1', [decoded.id]);

    if (rows.length === 0) return false;

    decoded.role = rows[0].role;
    decoded.name = rows[0].name;
    decoded.email = rows[0].email;
    return decoded;
  } catch (e) {
    return false;
  }
}

const sanitizeDate = (dateStr) => {
  if (!dateStr || dateStr.trim() === '') return null;
  return dateStr;
};

export async function GET() {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const db = await getDbConnection();

    const query = `
      SELECT p.*, u.name AS cp_name, u.phone AS cp_phone 
      FROM properties p 
      LEFT JOIN users u ON p.assigned_cp_id = u.id 
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.execute(query);

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const roleStr = (auth.role || '').toLowerCase();
    const allowedCreateRoles = ['super admin', 'admin', 'crm', 'crm team', 'sales', 'field executive', 'channel partner', 'cp'];
    if (!allowedCreateRoles.includes(roleStr)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await req.json();

    const validation = validatePropertyForm(data);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Draft Folder Check
    let draftFolderId = null;
    if (data.interest_letter_file && data.interest_letter_file.includes('draft-')) {
      draftFolderId = data.interest_letter_file.split('/')[1];
    } else if (data.document_checklist && Array.isArray(data.document_checklist)) {
      const draftDoc = data.document_checklist.find(d => d.file_name && d.file_name.includes('draft-'));
      if (draftDoc) draftFolderId = draftDoc.file_name.split('/')[1];
    }

    const db = await getDbConnection();

    const query = `
      INSERT INTO properties (
        assigned_cp_id, pmc_name, pmc_contact, property_name, address, locality, lat, lng, status,
        land_owner_name, land_type, cts_survey_no, is_society_registered, registration_no,
        total_plot_area, total_flats, total_shops, total_flat_area_combined,
        chairman_details, secretary_details, treasurer_details, responsible_person_details, extra_committee_members,
        has_approved_plan, has_oc, has_cc, has_legal_dispute, is_mortgaged, has_redevelopment_interest, 
        physical_survey_allowed, flat_measure_allowed, physical_survey, physical_survey_records, 
        banner_permission_allowed, hoarding_date,
        consent_type, consent_79a_file,
        document_checklist, document_remarks, 
        interest_letter_file, has_interest_letter, society_acknowledgement, 
        offer_letter_sent, offer_letter_files, offer_acceptance_letter, offer_acceptance_letter_file,
        approved_plan_file, cc_file, architect_survey_status, sent_to_architect,
        interaction_history, offer_letter_status, offer_meeting_track, offer_acceptance_date,
        sgm_completed, da_agreement_status, activity_logs, updated_by_name
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?,
        ?, ?,
        ?, ?, 
        ?, ?, ?, 
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `;

    const values = [
      data.assigned_cp_id || null, data.pmc_name || '', data.pmc_contact || '',
      data.property_name || 'Unnamed Property', data.address || '', data.locality || '',
      data.lat || 19.2813, data.lng || 72.8693, data.status || 'Not Approached',

      data.land_owner_name || '', data.land_type || 'Freehold', data.cts_survey_no || '',
      data.is_society_registered ? 1 : 0, data.registration_no || '',
      data.total_plot_area || '', data.total_flats || null, data.total_shops || null, data.total_flat_area_combined || '',

      JSON.stringify(data.chairman_details || {}), JSON.stringify(data.secretary_details || {}),
      JSON.stringify(data.treasurer_details || {}), JSON.stringify(data.responsible_person_details || {}),
      JSON.stringify(data.extra_committee_members || []),

      data.has_approved_plan ? 1 : 0, data.has_oc ? 1 : 0, data.has_cc ? 1 : 0,
      data.has_legal_dispute ? 1 : 0, data.is_mortgaged ? 1 : 0, data.has_redevelopment_interest ? 1 : 0,
      
      data.physical_survey_allowed ? 1 : 0, data.flat_measure_allowed ? 1 : 0, data.physical_survey || 'Not Started', data.physical_survey_records || '',
      data.banner_permission_allowed ? 1 : 0, sanitizeDate(data.hoarding_date),

      data.consent_type || '', data.consent_79a_file || '',

      JSON.stringify(data.document_checklist || []), data.document_remarks || '',
      
      data.interest_letter_file || '', data.has_interest_letter ? 1 : 0, data.society_acknowledgement ? 1 : 0,
      data.offer_letter_sent ? 1 : 0, JSON.stringify(data.offer_letter_files || []), data.offer_acceptance_letter ? 1 : 0, data.offer_acceptance_letter_file || '',
      
      data.approved_plan_file || '', data.cc_file || '', data.architect_survey_status || 'Not Started', data.sent_to_architect ? 1 : 0,

      data.interaction_history || '', data.offer_letter_status || 'Not Sent',
      data.offer_meeting_track || '', sanitizeDate(data.offer_acceptance_date),
      
      data.sgm_completed ? 1 : 0, data.da_agreement_status || 'Not Started', 
      
      data.activity_logs || '[]', auth.email || 'Unknown User'
    ];

    const [result] = await db.execute(query, values);
    const newPropertyId = result.insertId.toString();

    // Grouping / Clubbing Synchronization
    if (data.clubbed_properties && Array.isArray(data.clubbed_properties) && data.clubbed_properties.length > 0) {
      const placeholders = data.clubbed_properties.map(() => '?').join(',');
      const [clubCheck] = await db.execute(
        `SELECT club_id FROM properties WHERE id IN (${placeholders}) AND club_id IS NOT NULL LIMIT 1`,
        data.clubbed_properties
      );

      const finalClubId = clubCheck.length > 0 ? clubCheck[0].club_id : `club_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const allIdsToSync = [...data.clubbed_properties, newPropertyId];
      const syncPlaceholders = allIdsToSync.map(() => '?').join(',');
      
      await db.execute(
        `UPDATE properties SET club_id = ? WHERE id IN (${syncPlaceholders})`,
        [finalClubId, ...allIdsToSync]
      );
    }

    const finalPropertyName = data.property_name && data.property_name.trim() !== ''
      ? data.property_name.trim()
      : 'Unnamed_Property';

    if (draftFolderId && newPropertyId) {
      const safePropName = finalPropertyName.replace(/[^a-z0-9\s-]/gi, '').trim();
      const newFolderTarget = `${newPropertyId} - ${safePropName}`;

      await promoteDraftFiles(draftFolderId, newPropertyId, finalPropertyName);

      await db.execute(`
        UPDATE properties 
        SET 
            interest_letter_file = REPLACE(interest_letter_file, ?, ?),
            document_checklist = REPLACE(document_checklist, ?, ?),
            offer_letter_files = REPLACE(offer_letter_files, ?, ?),
            consent_79a_file = REPLACE(consent_79a_file, ?, ?),
            offer_acceptance_letter_file = REPLACE(offer_acceptance_letter_file, ?, ?),
            approved_plan_file = REPLACE(approved_plan_file, ?, ?),
            cc_file = REPLACE(cc_file, ?, ?)
        WHERE id = ?
      `, [
        draftFolderId, newFolderTarget, 
        draftFolderId, newFolderTarget,
        draftFolderId, newFolderTarget,
        draftFolderId, newFolderTarget,
        draftFolderId, newFolderTarget,
        draftFolderId, newFolderTarget,
        draftFolderId, newFolderTarget,
        newPropertyId
      ]);
    }

    return NextResponse.json({
      success: true,
      id: newPropertyId,
      message: 'Property successfully added'
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Database insertion failed: ' + error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const roleStr = (auth.role || '').toLowerCase();
    const allowedUpdateRoles = ['super admin', 'admin', 'crm', 'crm team'];
    if (!allowedUpdateRoles.includes(roleStr)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Missing ID or Status' }, { status: 400 });
    }

    const db = await getDbConnection();

    const query = `UPDATE properties SET status = ?, updated_by_name = ? WHERE id = ?`;
    await db.execute(query, [status, auth.email || 'Unknown User', id]);

    return NextResponse.json({
      success: true,
      message: `Property ${id} status updated to ${status}`
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}