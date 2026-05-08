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

// AUTO-STATUS CALCULATION ENGINE
const STATUS_FLOW = [
  'Not Approached',
  'Interest Letter Sent',
  'Society Docs Received',
  'Architect Survey Phase',
  'Offer Letter Sent',
  'Offer Under Negotiation',
  'Offer Accepted',
  'Consent Phase',
  'DA Phase',
  'Plan & CC Phase'
];

const calculateAutoStatus = (data, currentDbStatus = 'Not Approached') => {
  let maxIndex = 0;

  let logs = [];
  try {
    if (Array.isArray(data.activity_logs)) logs = data.activity_logs;
    else if (typeof data.activity_logs === 'string') logs = JSON.parse(data.activity_logs);
  } catch(e) {}

  let offerFiles = [];
  try {
    if (Array.isArray(data.offer_letter_files)) offerFiles = data.offer_letter_files;
    else if (typeof data.offer_letter_files === 'string') offerFiles = JSON.parse(data.offer_letter_files);
  } catch(e) {}

  if (data.has_approved_plan === 1 || data.has_cc === 1 || data.approved_plan_file || data.cc_file) maxIndex = 9;
  else if (data.da_agreement_status === 'In Process' || data.da_agreement_status === 'Completed') maxIndex = 8;
  else if (data.consent_79a_file || data.consent_type === '100%') maxIndex = 7;
  else if (data.offer_acceptance_letter_file || data.offer_letter_status === 'Accepted') maxIndex = 6;
  else if (data.offer_letter_status === 'Under Negotiation' || logs.some(l => l.category === 'Offer Negotiation')) maxIndex = 5;
  else if ((offerFiles && offerFiles.length > 0) || data.offer_letter_sent === 1) maxIndex = 4;
  else if (data.architect_survey_status === 'Started' || data.architect_survey_status === 'Completed' || data.sent_to_architect === 1) maxIndex = 3;
  else if (data.society_acknowledgement === 1) maxIndex = 2;
  else if (data.interest_letter_file || data.has_interest_letter === 1) maxIndex = 1;

  const currentDbIndex = STATUS_FLOW.indexOf(currentDbStatus);
  const incomingManualIndex = STATUS_FLOW.indexOf(data.status);
  
  const finalIndex = Math.max(maxIndex, currentDbIndex > -1 ? currentDbIndex : 0, incomingManualIndex > -1 ? incomingManualIndex : 0);
  
  return STATUS_FLOW[finalIndex] || 'Not Approached';
};

export async function GET(req, { params }) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No ID provided" }, { status: 400 });

    const db = await getDbConnection();

    const query = `
      SELECT p.*, u.name AS cp_name, u.phone AS cp_phone 
      FROM properties p 
      LEFT JOIN users u ON p.assigned_cp_id = u.id 
      WHERE p.id = ?
    `;
    const [rows] = await db.execute(query, [id]);

    if (rows.length === 0) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const property = rows[0];
    let clubbed_properties = [];

    // Fetch sibling properties if part of a club
    if (property.club_id) {
        const [siblings] = await db.execute(
            `SELECT id, property_name, address FROM properties WHERE club_id = ? AND id != ?`,
            [property.club_id, id]
        );
        clubbed_properties = siblings;
    }

    return NextResponse.json({ ...property, clubbed_properties });
  } catch (error) {
    console.error('SERVER-SIDE API ERROR:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No ID provided" }, { status: 400 });

    const data = await req.json();

    const validation = validatePropertyForm(data);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const db = await getDbConnection();

    const [existingRows] = await db.execute('SELECT property_name, status FROM properties WHERE id = ?', [id]);
    if (existingRows.length === 0) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const oldName = existingRows[0].property_name || 'Unnamed_Property';
    const oldStatus = existingRows[0].status || 'Not Approached';
    const newName = data.property_name && data.property_name.trim() !== '' ? data.property_name.trim() : 'Unnamed_Property';

    const calculatedStatus = calculateAutoStatus(data, oldStatus);

    let finalInterestLetter = data.interest_letter_file || '';
    let finalChecklist = data.document_checklist || [];
    let finalOfferLetterFiles = data.offer_letter_files || [];
    let finalOfferAcceptanceFile = data.offer_acceptance_letter_file || '';
    let finalApprovedPlanFile = data.approved_plan_file || '';
    let finalCcFile = data.cc_file || '';
    let finalConsent79aFile = data.consent_79a_file || '';

    if (oldName !== newName) {
      const safeOldName = oldName.replace(/[^a-z0-9\s-]/gi, '').trim() || 'Unnamed_Property';
      const safeNewName = newName.replace(/[^a-z0-9\s-]/gi, '').trim() || 'Unnamed_Property';

      const oldFolder = `${id} - ${safeOldName}`;
      const newFolder = `${id} - ${safeNewName}`;

      await promoteDraftFiles(oldFolder, id, newName);

      if (finalInterestLetter) finalInterestLetter = finalInterestLetter.replace(oldFolder, newFolder);
      if (finalOfferAcceptanceFile) finalOfferAcceptanceFile = finalOfferAcceptanceFile.replace(oldFolder, newFolder);
      if (finalApprovedPlanFile) finalApprovedPlanFile = finalApprovedPlanFile.replace(oldFolder, newFolder);
      if (finalCcFile) finalCcFile = finalCcFile.replace(oldFolder, newFolder);
      if (finalConsent79aFile) finalConsent79aFile = finalConsent79aFile.replace(oldFolder, newFolder);

      if (Array.isArray(finalOfferLetterFiles)) {
        finalOfferLetterFiles = finalOfferLetterFiles.map(f => f.replace(oldFolder, newFolder));
      }

      finalChecklist = finalChecklist.map(doc => {
        if (doc.file_name) {
          return { ...doc, file_name: doc.file_name.replace(oldFolder, newFolder) };
        }
        return doc;
      });
    }

    const query = `
      UPDATE properties SET 
        assigned_cp_id = ?, pmc_name = ?, pmc_contact = ?, property_name = ?, address = ?, locality = ?, lat = ?, lng = ?, status = ?,
        land_owner_name = ?, land_type = ?, cts_survey_no = ?, is_society_registered = ?, registration_no = ?,
        total_plot_area = ?, total_flats = ?, total_shops = ?, total_flat_area_combined = ?,
        chairman_details = ?, secretary_details = ?, treasurer_details = ?, responsible_person_details = ?, extra_committee_members = ?,
        has_approved_plan = ?, has_oc = ?, has_cc = ?, has_legal_dispute = ?, is_mortgaged = ?, has_redevelopment_interest = ?,
        physical_survey_allowed = ?, flat_measure_allowed = ?, physical_survey = ?, physical_survey_records = ?, 
        banner_permission_allowed = ?, hoarding_date = ?,
        consent_type = ?, consent_79a_file = ?,
        document_checklist = ?, document_remarks = ?, 
        interest_letter_file = ?, has_interest_letter = ?, society_acknowledgement = ?, 
        offer_letter_sent = ?, offer_letter_files = ?, offer_acceptance_letter = ?, offer_acceptance_letter_file = ?,
        approved_plan_file = ?, cc_file = ?, architect_survey_status = ?, sent_to_architect = ?,
        interaction_history = ?, offer_letter_status = ?, offer_meeting_track = ?, offer_acceptance_date = ?,
        sgm_completed = ?, da_agreement_status = ?, project_progress = ?, activity_logs = ?, updated_by_name = ?
      WHERE id = ?
    `;

    const values = [
      data.assigned_cp_id || null, data.pmc_name || '', data.pmc_contact || '',
      data.property_name || 'Unnamed Property', data.address || '', data.locality || '',
      data.lat || 19.2813, data.lng || 72.8693, calculatedStatus,

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

      data.consent_type || '', finalConsent79aFile,

      JSON.stringify(finalChecklist), data.document_remarks || '',
      
      finalInterestLetter, data.has_interest_letter ? 1 : 0, data.society_acknowledgement ? 1 : 0,
      data.offer_letter_sent ? 1 : 0, JSON.stringify(finalOfferLetterFiles), data.offer_acceptance_letter ? 1 : 0, finalOfferAcceptanceFile,
      
      finalApprovedPlanFile, finalCcFile, data.architect_survey_status || 'Not Started', data.sent_to_architect ? 1 : 0,

      data.interaction_history || '', data.offer_letter_status || 'Not Sent',
      data.offer_meeting_track || '', sanitizeDate(data.offer_acceptance_date),
      
      data.sgm_completed ? 1 : 0, data.da_agreement_status || 'Not Started', data.project_progress || 'Not Started', 
      
      data.activity_logs || '[]', auth.email || 'Unknown User',
      id
    ];

    await db.execute(query, values);

    // Grouping / Clubbing Synchronization
    if (Array.isArray(data.clubbed_properties)) {
      if (data.clubbed_properties.length === 0) {
        await db.execute(`UPDATE properties SET club_id = NULL WHERE id = ?`, [id]);
      } else {
        const allIdsToSync = [id, ...data.clubbed_properties];
        const placeholders = allIdsToSync.map(() => '?').join(',');

        const [clubCheck] = await db.execute(
          `SELECT club_id FROM properties WHERE id IN (${placeholders}) AND club_id IS NOT NULL LIMIT 1`,
          allIdsToSync
        );

        const finalClubId = clubCheck.length > 0 ? clubCheck[0].club_id : `club_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        await db.execute(
          `UPDATE properties SET club_id = NULL WHERE club_id = ? AND id NOT IN (${placeholders})`,
          [finalClubId, ...allIdsToSync]
        );

        await db.execute(
          `UPDATE properties SET club_id = ? WHERE id IN (${placeholders})`,
          [finalClubId, ...allIdsToSync]
        );
      }
    }

    return NextResponse.json({ success: true, message: "Property updated successfully" });

  } catch (error) {
    console.error('UPDATE ERROR:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await verifyAuth();

    if (!auth || (auth.role !== 'Super Admin' && auth.role !== 'Admin')) {
      return NextResponse.json({ error: 'Unauthorized: Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No ID provided" }, { status: 400 });

    const db = await getDbConnection();
    await db.execute('DELETE FROM properties WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    console.error('DELETE ERROR:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}