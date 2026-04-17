import { getDbConnection } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { validatePropertyForm } from '@/utils/propertyForm';

// --- Auth Helper ---
async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('asmita_auth')?.value;
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_asmita_erp_2026');
    return decoded;
  } catch (e) {
    return false;
  }
}

// --- Date Sanitization Helper ---
const sanitizeDate = (dateStr) => {
  if (!dateStr || dateStr.trim() === '') return null;
  return dateStr;
};

// ==========================================
// GET: Fetch Single Property for Editing
// ==========================================
export async function GET(req, { params }) {
  try {
    // 1. Authenticate Request
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No ID provided" }, { status: 400 });

    const db = await getDbConnection();
    const [rows] = await db.execute('SELECT * FROM properties WHERE id = ?', [id]);

    if (rows.length === 0) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('SERVER-SIDE API ERROR:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ==========================================
// PUT: Update Entire Property Record
// ==========================================
export async function PUT(req, { params }) {
  try {
    // 1. Authenticate Request
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No ID provided" }, { status: 400 });

    const data = await req.json();

    // 2. Validate Payload
    const validation = validatePropertyForm(data);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const db = await getDbConnection();

    // 3. Construct the Flat Update Query
    const query = `
      UPDATE properties SET 
        assigned_cp_id = ?, pmc_name = ?, pmc_contact = ?, property_name = ?, address = ?, locality = ?, lat = ?, lng = ?, status = ?,
        land_owner_name = ?, land_type = ?, cts_survey_no = ?, is_society_registered = ?, registration_no = ?,
        total_plot_area = ?, total_flats = ?, total_shops = ?, total_flat_area_combined = ?,
        chairman_details = ?, secretary_details = ?, treasurer_details = ?, responsible_person_details = ?, extra_committee_members = ?,
        has_approved_plan = ?, has_oc = ?, has_cc = ?, has_legal_dispute = ?, is_mortgaged = ?, has_redevelopment_interest = ?, flat_measure_allowed = ?,
        physical_survey = ?, physical_survey_records = ?, banner_permission_allowed = ?, hoarding_date = ?,
        document_checklist = ?, document_remarks = ?, interest_letter_file = ?, architect_submitted = ?,
        interaction_history = ?, offer_letter_status = ?, offer_meeting_track = ?, offer_acceptance_date = ?,
        sgm_completed = ?, da_agreement_status = ?
      WHERE id = ?
    `;

    // 4. Map values exactly to the schema
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
      data.sgm_completed ? 1 : 0, data.da_agreement_status || 'Not Started',

      // ID goes last for the WHERE clause
      id
    ];

    await db.execute(query, values);

    return NextResponse.json({ success: true, message: "Property updated successfully" });

  } catch (error) {
    console.error('UPDATE ERROR:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}