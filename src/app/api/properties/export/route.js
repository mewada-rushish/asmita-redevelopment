import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDbConnection } from '@/lib/db';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';

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

// --- DigitalOcean Link Generator ---
const getDoLink = (key) => {
  if (!key || typeof key !== 'string' || key.trim() === '') return null;
  const bucket = process.env.DO_SPACES_BUCKET || 'asmita-redevelopment'; // Fallback if env is missing
  // Encode everything except the slashes to match DO's URL structure
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');
  return `https://${bucket}.sgp1.digitaloceanspaces.com/${encodedKey}`;
};

// --- Formatting Helpers ---
const toYesNo = (val) => (val === 1 || val === '1' || val === true ? 'Yes' : 'No');

// Converts a file path into a clickable Excel hyperlink object pointing directly to DO Spaces
const getFileLink = (val) => {
  const link = getDoLink(val);
  return link ? { text: 'View Document', hyperlink: link } : 'Not Shared';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString(); } catch (e) { return ''; }
};

const formatContact = (jsonString) => {
  if (!jsonString) return 'N/A';
  try {
    const obj = JSON.parse(jsonString);
    if (obj.name || obj.contact) {
      return `${obj.name || 'N/A'} ${obj.contact ? `(${obj.contact})` : ''}`.trim();
    }
  } catch (e) {}
  return 'N/A';
};

const formatExtraMembers = (jsonString) => {
  if (!jsonString) return 'N/A';
  try {
    const arr = JSON.parse(jsonString);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter(m => m.name || m.contact)
        .map(m => `${m.name || 'N/A'} ${m.contact ? `(${m.contact})` : ''}`.trim())
        .join(' | ');
    }
  } catch (e) {}
  return 'N/A';
};

const formatOfferFiles = (jsonString) => {
  if (!jsonString) return 'Not Shared';
  try {
    const arr = JSON.parse(jsonString);
    if (Array.isArray(arr) && arr.length > 0) {
      // For multiple files, we output raw clickable DO URLs separated by newlines
      return arr.map(f => getDoLink(f)).filter(Boolean).join('\n');
    }
  } catch(e) {}
  return 'Not Shared';
};

const formatLastLog = (jsonString) => {
  if (!jsonString) return 'None';
  try {
    const arr = JSON.parse(jsonString);
    if (Array.isArray(arr) && arr.length > 0) {
      return `${arr[0].date.split(',')[0]} - ${arr[0].category}: ${arr[0].note}`;
    }
  } catch(e) {}
  return 'None';
};

// Checklist parser that checks for files and returns DO links
const getChecklistStatus = (jsonString, docLabel) => {
  if (!jsonString) return 'Not Shared';
  try {
    const arr = JSON.parse(jsonString);
    const doc = arr.find(d => d.label === docLabel);
    if (doc && (doc.value === 1 || doc.value === true)) {
      if (doc.file_name) {
        const link = getDoLink(doc.file_name);
        return link ? { text: 'View Document', hyperlink: link } : 'Shared (No File)';
      }
      return 'Shared (No File)'; // If marked YES but file wasn't uploaded
    }
  } catch (e) {}
  return 'Not Shared';
};

// --- Excel Columns Definition ---
const baseColumns = [
  { header: 'Prop ID', width: 10, fn: r => r.id },
  { header: 'Property Name', width: 30, fn: r => r.property_name },
  { header: 'Status', width: 22, fn: r => r.status },
  { header: 'Locality', width: 20, fn: r => r.locality },
  { header: 'Full Address', width: 40, fn: r => r.address },
  { header: 'Assigned CP', width: 25, fn: r => r.cp_name || 'Unassigned' },
  { header: 'PMC Name', width: 20, fn: r => r.pmc_name },
  { header: 'PMC Contact', width: 15, fn: r => r.pmc_contact },
  { header: 'Reporting Manager', width: 25, fn: r => r.assigned_admin_name || 'Unassigned' },

  // Land & Legal
  { header: 'Land Owner', width: 25, fn: r => r.land_owner_name },
  { header: 'Land Type', width: 15, fn: r => r.land_type },
  { header: 'CTS / Survey No', width: 20, fn: r => r.cts_survey_no },

  // Society
  { header: 'Society Registered?', width: 18, fn: r => toYesNo(r.is_society_registered) },
  { header: 'Registration No', width: 20, fn: r => r.registration_no },

  // Committee
  { header: 'Chairman', width: 25, fn: r => formatContact(r.chairman_details) },
  { header: 'Secretary', width: 25, fn: r => formatContact(r.secretary_details) },
  { header: 'Treasurer', width: 25, fn: r => formatContact(r.treasurer_details) },
  { header: 'Responsible Person', width: 25, fn: r => formatContact(r.responsible_person_details) },
  { header: 'Extra Members', width: 40, fn: r => formatExtraMembers(r.extra_committee_members) },

  // Area Info
  { header: 'Total Plot Area', width: 18, fn: r => r.total_plot_area },
  { header: 'Total Flats', width: 12, fn: r => r.total_flats },
  { header: 'Total Shops', width: 12, fn: r => r.total_shops },
  { header: 'Combined Flat Area', width: 20, fn: r => r.total_flat_area_combined },

  // Permissions & Survey
  { header: 'Has OC?', width: 12, fn: r => toYesNo(r.has_oc) },
  { header: 'Legal Dispute?', width: 15, fn: r => toYesNo(r.has_legal_dispute) },
  { header: 'Mortgaged?', width: 15, fn: r => toYesNo(r.is_mortgaged) },
  { header: 'Redevelopment Interest?', width: 22, fn: r => toYesNo(r.has_redevelopment_interest) },
  { header: 'Physical Survey Allowed?', width: 25, fn: r => toYesNo(r.physical_survey_allowed) },
  { header: 'Flat Measurement Allowed?', width: 25, fn: r => toYesNo(r.flat_measure_allowed) },
  { header: 'Banner Permission Allowed?', width: 25, fn: r => toYesNo(r.banner_permission_allowed) },
  { header: 'Hoarding Date', width: 15, fn: r => formatDate(r.hoarding_date) },
  { header: 'Physical Survey Status', width: 22, fn: r => r.physical_survey },
  { header: 'Physical Survey Records', width: 35, fn: r => r.physical_survey_records },

  // Consent
  { header: 'Consent Type', width: 15, fn: r => r.consent_type },
  { header: '79/A Consent Document', width: 25, fn: r => getFileLink(r.consent_79a_file) },

  // Proposals & Offers
  { header: 'Interest Letter Sent?', width: 22, fn: r => toYesNo(r.has_interest_letter) },
  { header: 'Interest Letter Document', width: 25, fn: r => getFileLink(r.interest_letter_file) },
  { header: 'Society Acknowledgement?', width: 25, fn: r => toYesNo(r.society_acknowledgement) },
  { header: 'Offer Letter Sent?', width: 18, fn: r => toYesNo(r.offer_letter_sent) },
  { header: 'Offer Letter Documents', width: 40, fn: r => formatOfferFiles(r.offer_letter_files) },
  { header: 'Offer Acceptance Letter?', width: 25, fn: r => toYesNo(r.offer_acceptance_letter) },
  { header: 'Offer Acceptance Document', width: 28, fn: r => getFileLink(r.offer_acceptance_letter_file) },
  { header: 'Interaction History', width: 40, fn: r => r.interaction_history },
  { header: 'Offer Letter Status', width: 22, fn: r => r.offer_letter_status },
  { header: 'Offer Meeting Track', width: 40, fn: r => r.offer_meeting_track },
  { header: 'Offer Acceptance Date', width: 20, fn: r => formatDate(r.offer_acceptance_date) },

  // Document Remarks
  { header: 'Overall Document Remarks', width: 40, fn: r => r.document_remarks },
];

// Dynamically generate the 20 Checklist Columns
const checklistNames = [
  "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
  "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
  "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
  "MBMC Approved plan with OC", "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
];

const checklistColumns = checklistNames.map(docName => ({
  header: `Doc: ${docName}`,
  width: 25,
  fn: r => getChecklistStatus(r.document_checklist, docName)
}));

// Trailing Columns
const trailingColumns = [
  { header: 'Approved Plan Status?', width: 22, fn: r => toYesNo(r.has_approved_plan) },
  { header: 'Approved Plan Document', width: 25, fn: r => getFileLink(r.approved_plan_file) },
  { header: 'Has CC?', width: 12, fn: r => toYesNo(r.has_cc) },
  { header: 'CC Document', width: 25, fn: r => getFileLink(r.cc_file) },
  { header: 'Architect Survey Status', width: 22, fn: r => r.architect_survey_status },
  { header: 'Sent to Architect?', width: 20, fn: r => toYesNo(r.sent_to_architect) },

  { header: 'SGM Completed?', width: 18, fn: r => toYesNo(r.sgm_completed) },
  { header: 'DA Agreement Status', width: 22, fn: r => r.da_agreement_status },
  { header: 'Project Progress', width: 22, fn: r => r.project_progress },
  { header: 'Latest Activity Log', width: 50, fn: r => formatLastLog(r.activity_logs) },

  { header: 'Added On', width: 15, fn: r => formatDate(r.created_at) },
  { header: 'Last Updated By', width: 25, fn: r => r.updated_by_name || 'Unknown' },
];

const COLUMNS = [...baseColumns, ...checklistColumns, ...trailingColumns];

export async function GET(request) {
  try {
    const auth = await verifyAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cpId = searchParams.get('cpId');
    const propertyId = searchParams.get('propertyId');

    const db = await getDbConnection();
    
    let query = `
      SELECT p.*, 
             u1.name AS cp_name,
             u2.name AS assigned_admin_name
      FROM properties p 
      LEFT JOIN users u1 ON p.assigned_cp_id = u1.id
      LEFT JOIN users u2 ON p.assigned_admin_id = u2.id
    `;
    let params = [];

    if (propertyId) {
      query += ' WHERE p.id = ?';
      params.push(propertyId);
    } else if (cpId) {
      query += ' WHERE p.assigned_cp_id = ?';
      params.push(cpId);
    }
    
    query += ' ORDER BY p.id DESC';
    const [rows] = await db.execute(query, params);

    if (rows.length === 0) {
      return new NextResponse("<h2>No properties found for this request.</h2><p>You can close this tab.</p>", {
        headers: { "Content-Type": "text/html" }
      });
    }

    const primaryCpName = rows[0].cp_name || 'Unassigned';
    const safeCpName = primaryCpName.replace(/[^a-zA-Z0-9]/g, '_');
    
    let filename = 'Properties_Export.xlsx';
    if (propertyId) {
      filename = `${safeCpName}_Property_${propertyId}.xlsx`;
    } else if (cpId) {
      filename = `${safeCpName}_${rows.length}_Properties.xlsx`;
    } else {
      filename = `AsmitA_Global_Properties.xlsx`;
    }

    // --- Generate Native Excel File ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Properties');
    let rowIndex = 1;

    // 1. Title Header Row
    if (cpId || propertyId) {
      worksheet.mergeCells(rowIndex, 1, rowIndex, COLUMNS.length);
      const headerCell = worksheet.getCell(rowIndex, 1);
      headerCell.value = `CHANNEL PARTNER: ${primaryCpName}`;
      
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; 
      headerCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
      headerCell.border = {
        top: { style: 'thick', color: { argb: 'FF000000' } },
        left: { style: 'thick', color: { argb: 'FF000000' } },
        bottom: { style: 'thick', color: { argb: 'FF000000' } },
        right: { style: 'thick', color: { argb: 'FF000000' } }
      };
      headerCell.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(rowIndex).height = 30;

      rowIndex += 2; 
    }

    // 2. Add Headers
    const headerRow = worksheet.getRow(rowIndex);
    COLUMNS.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; 
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; 
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
      worksheet.getColumn(index + 1).width = col.width || 15;
    });

    // 3. Populate Data Rows with Hyperlinks
    rows.forEach(r => {
      rowIndex++;
      const dataRow = worksheet.getRow(rowIndex);
      COLUMNS.forEach((col, index) => {
        const cell = dataRow.getCell(index + 1);
        
        const val = col.fn(r);
        
        // Check if our formatter returned a Hyperlink Object
        if (val && typeof val === 'object' && val.hyperlink) {
          cell.value = val;
          cell.font = { color: { argb: 'FF0563C1' }, underline: true };
        } else {
          cell.value = val;
        }

        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: 'Failed to generate export file' }, { status: 500 });
  }
}