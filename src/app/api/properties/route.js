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
    const [rows] = await db.execute('SELECT * FROM properties ORDER BY created_at DESC');

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

    // Isolate the draft ID
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
        has_approved_plan, has_oc, has_cc, has_legal_dispute, is_mortgaged, has_redevelopment_interest, flat_measure_allowed,
        physical_survey, physical_survey_records, banner_permission_allowed, hoarding_date,
        document_checklist, document_remarks, interest_letter_file, architect_submitted,
        interaction_history, offer_letter_status, offer_meeting_track, offer_acceptance_date,
        sgm_completed, da_agreement_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
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
      data.has_legal_dispute ? 1 : 0, data.is_mortgaged ? 1 : 0, data.has_redevelopment_interest ? 1 : 0, data.flat_measure_allowed ? 1 : 0,

      data.physical_survey || 'Not Started', data.physical_survey_records || '',
      data.banner_permission_allowed ? 1 : 0, sanitizeDate(data.hoarding_date),

      JSON.stringify(data.document_checklist || []), data.document_remarks || '',
      data.interest_letter_file || '', data.architect_submitted ? 1 : 0,

      data.interaction_history || '', data.offer_letter_status || 'Not Sent',
      data.offer_meeting_track || '', sanitizeDate(data.offer_acceptance_date),
      data.sgm_completed ? 1 : 0, data.da_agreement_status || 'Not Started'
    ];

    const [result] = await db.execute(query, values);
    const newPropertyId = result.insertId.toString();

    // FORCE the final property name from the form, bypassing the draft name
    const finalPropertyName = data.property_name && data.property_name.trim() !== ''
      ? data.property_name.trim()
      : 'Unnamed_Property';

    if (draftFolderId && newPropertyId) {
      const safePropName = finalPropertyName.replace(/[^a-z0-9\s-]/gi, '').trim();
      const newFolderTarget = `${newPropertyId} - ${safePropName}`;

      // Move files using the strict final property name
      await promoteDraftFiles(draftFolderId, newPropertyId, finalPropertyName);

      await db.execute(`
        UPDATE properties 
        SET 
            interest_letter_file = REPLACE(interest_letter_file, ?, ?),
            document_checklist = REPLACE(document_checklist, ?, ?)
        WHERE id = ?
      `, [draftFolderId, newFolderTarget, draftFolderId, newFolderTarget, newPropertyId]);
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
    const query = `UPDATE properties SET status = ? WHERE id = ?`;
    await db.execute(query, [status, id]);

    return NextResponse.json({
      success: true,
      message: `Property ${id} status updated to ${status}`
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}