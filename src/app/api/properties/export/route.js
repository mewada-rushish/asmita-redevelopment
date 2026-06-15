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

// Complete 20-item Document checklist schema matching exactly what you use in Add/Edit forms
const checklistLabels = [
  "Old Agreement (One Copy)", "Gaon Namuna 2", "7/12 Extract", "Approved Survey Plan", "Physical Plot Survey",
  "Structural Audit Report", "Society Reg Certificate", "Committee Details", "Members List", "Carpet Area Statement",
  "Property Tax Bill", "Conveyance Deed", "Society Bye-laws", "Electricity Bill", "Water Bill", "Encumbrance Cert",
  "MBMC Approved plan with OC", "Any NOC", "C-1 Notice (MBMC)", "Latest Assessment Receipt"
];

export async function GET(request) {
  try {
    // 1. Authenticate user
    const auth = await verifyAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cpId = searchParams.get('cpId');
    const propertyId = searchParams.get('propertyId');
    const idsParam = searchParams.get('ids'); 

    const db = await getDbConnection();
    let query = '';
    let params = [];
    let filePrefix = 'properties_export';

    // 2. Select query execution path
    if (propertyId) {
      query = `
        SELECT p.*, u.name AS cp_name 
        FROM properties p 
        LEFT JOIN users u ON p.assigned_cp_id = u.id 
        WHERE p.id = ?
      `;
      params = [propertyId];
      filePrefix = `property_id_${propertyId}`;
    } else if (cpId) {
      query = `
        SELECT p.*, u.name AS cp_name 
        FROM properties p 
        LEFT JOIN users u ON p.assigned_cp_id = u.id 
        WHERE p.assigned_cp_id = ?
      `;
      params = [cpId];
      filePrefix = `cp_id_${cpId}_list`;
    } else if (idsParam) {
      const idArray = idsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      if (idArray.length === 0) {
        return new NextResponse("<h2>Invalid properties selection passed.</h2>", { headers: { "Content-Type": "text/html" } });
      }
      const placeholders = idArray.map(() => '?').join(',');
      query = `
        SELECT p.*, u.name AS cp_name 
        FROM properties p 
        LEFT JOIN users u ON p.assigned_cp_id = u.id 
        WHERE p.id IN (${placeholders})
      `;
      params = idArray;
      filePrefix = 'properties_filtered_report';
    } else {
      query = `
        SELECT p.*, u.name AS cp_name 
        FROM properties p 
        LEFT JOIN users u ON p.assigned_cp_id = u.id
      `;
      filePrefix = 'properties_complete_report';
    }

    const [rows] = await db.execute(query, params);

    if (rows.length === 0) {
      return new NextResponse("<h2>No matching properties found.</h2>", { headers: { "Content-Type": "text/html" } });
    }

    // Determine safe, human-readable file titles
    let finalFileName = `${filePrefix}.xlsx`;
    if (rows.length === 1 && rows[0].property_name) {
      const safePropName = rows[0].property_name.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      finalFileName = `${safePropName}_Details.xlsx`;
    } else if (cpId && rows[0].cp_name) {
      const safeCpName = rows[0].cp_name.replace(/[^a-z0-9]/gi, '_');
      finalFileName = `${safeCpName}_Linked_Properties.xlsx`;
    }

    // DigitalOcean Space virt-hosted public structure
    const s3Bucket = process.env.DO_SPACES_BUCKET || 'asmita-redevelopment';
    const s3BaseUrl = `https://${s3Bucket}.sgp1.digitaloceanspaces.com`;

    const getS3Hyperlink = (fileKey) => {
      if (!fileKey || fileKey === 'bulk_override_placeholder') return null;
      return `${s3BaseUrl}/${encodeURIComponent(fileKey).replace(/%2F/g, '/')}`;
    };

    // 3. Setup Workbook & Worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Properties Database');

    // Headers map (base parameters)
    const baseHeaders = [
      { header: 'Property ID', key: 'id', width: 12 },
      { header: 'Property Name', key: 'property_name', width: 28 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Locality', key: 'locality', width: 20 },
      { header: 'Status (Current Phase)', key: 'status', width: 24 },
      { header: 'Channel Partner Name', key: 'cp_name', width: 24 },
      { header: 'Total Plot Area', key: 'total_plot_area', width: 16 },
      { header: 'Total Flats', key: 'total_flats', width: 12 },
      { header: 'Total Shops', key: 'total_shops', width: 12 },
      { header: 'Combined Flat Area', key: 'total_flat_area_combined', width: 20 },
      { header: 'PMC Name', key: 'pmc_name', width: 20 },
      { header: 'PMC Contact', key: 'pmc_contact', width: 16 },
      { header: 'Land Owner Name', key: 'land_owner_name', width: 25 },
      { header: 'Land Type', key: 'land_type', width: 14 },
      { header: 'CTS Survey No', key: 'cts_survey_no', width: 18 },
      { header: 'Society Registered', key: 'is_society_registered', width: 18 },
      { header: 'Registration No', key: 'registration_no', width: 20 },
      { header: 'Chairman Name & Contact', key: 'chairman_details', width: 30 },
      { header: 'Secretary Name & Contact', key: 'secretary_details', width: 30 },
      { header: 'Treasurer Name & Contact', key: 'treasurer_details', width: 30 },
      { header: 'Responsible Person Details', key: 'responsible_person_details', width: 30 },
      { header: 'Extra Committee Members', key: 'extra_committee_members', width: 35 },
      { header: 'Has Approved Plan', key: 'has_approved_plan', width: 18 },
      { header: 'Approved Plan File Link', key: 'approved_plan_file', width: 25 },
      { header: 'Has OC', key: 'has_oc', width: 12 },
      { header: 'Has CC', key: 'has_cc', width: 12 },
      { header: 'CC File Link', key: 'cc_file', width: 25 },
      { header: 'Has Legal Dispute', key: 'has_legal_dispute', width: 18 },
      { header: 'Is Mortgaged', key: 'is_mortgaged', width: 14 },
      { header: 'Has Redevelopment Interest', key: 'has_redevelopment_interest', width: 25 },
      { header: 'Physical Survey Allowed', key: 'physical_survey_allowed', width: 22 },
      { header: 'Flat Measure Allowed', key: 'flat_measure_allowed', width: 22 },
      { header: 'Physical Survey Phase', key: 'physical_survey', width: 20 },
      { header: 'Physical Survey Records', key: 'physical_survey_records', width: 30 },
      { header: 'Banner/Hoarding Allowed', key: 'banner_permission_allowed', width: 24 },
      { header: 'Hoarding Date', key: 'hoarding_date', width: 15 },
      { header: 'Consent Type', key: 'consent_type', width: 15 },
      { header: '79/A Consent File Link', key: 'consent_79a_file', width: 25 },
      { header: 'Interest Letter File Link', key: 'interest_letter_file', width: 25 },
      { header: 'Has Interest Letter', key: 'has_interest_letter', width: 18 },
      { header: 'Society Acknowledgement', key: 'society_acknowledgement', width: 24 },
      { header: 'Offer Letter Sent', key: 'offer_letter_sent', width: 18 },
      { header: 'Offer Letter Files Links', key: 'offer_letter_files', width: 30 },
      { header: 'Offer Acceptance Letter Status', key: 'offer_acceptance_letter', width: 28 },
      { header: 'Offer Acceptance File Link', key: 'offer_acceptance_letter_file', width: 25 },
      { header: 'Architect Survey Status', key: 'architect_survey_status', width: 22 },
      { header: 'Sent to Architect', key: 'sent_to_architect', width: 18 },
      { header: 'SGM Completed', key: 'sgm_completed', width: 16 },
      { header: 'DA Agreement Status', key: 'da_agreement_status', width: 22 },
      { header: 'On-Ground Project Progress', key: 'project_progress', width: 25 },
      { header: 'Document Remarks / Notes', key: 'document_remarks', width: 30 },
      { header: 'Updated By', key: 'updated_by_name', width: 20 },
      { header: 'Club/Group ID', key: 'club_id', width: 20 }
    ];

    // Checklist dynamics columns mapping
    const checklistHeaders = checklistLabels.map(label => ({
      header: `Doc Check: ${label}`,
      key: `checklist_${label.replace(/\s+/g, '_')}`,
      width: 25
    }));

    worksheet.columns = [...baseHeaders, ...checklistHeaders];

    // Styled Top Header Layout
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '27347B' } // AsmitA corporate Deep Navy
      };
      cell.font = {
        name: 'Arial',
        color: { argb: 'FFFFFF' },
        bold: true,
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '4F5B93' } }
      };
    });

    const parseNestedObj = (str) => {
      if (!str) return '';
      if (typeof str === 'object') return str;
      try {
        return JSON.parse(str);
      } catch (e) {
        return '';
      }
    };

    const formatCommittee = (details) => {
      const d = parseNestedObj(details);
      if (!d || (!d.name && !d.contact)) return 'Not Added';
      return `${d.name || 'N/A'} (Contact: ${d.contact || 'N/A'})`;
    };

    const formatBool = (val) => {
      return (val === 1 || val === '1' || val === true) ? 'Yes' : 'No';
    };

    // 4. Rows Population
    rows.forEach((row, rowIndex) => {
      const dataRow = {};

      dataRow.id = row.id;
      dataRow.property_name = row.property_name || 'Unnamed Property';
      dataRow.address = row.address || 'N/A';
      dataRow.locality = row.locality || 'N/A';
      dataRow.status = row.status || 'Not Approached';
      dataRow.cp_name = row.cp_name || 'Direct / Unassigned';
      dataRow.total_plot_area = row.total_plot_area || '-';
      dataRow.total_flats = row.total_flats;
      dataRow.total_shops = row.total_shops;
      dataRow.total_flat_area_combined = row.total_flat_area_combined || '-';
      dataRow.pmc_name = row.pmc_name || '-';
      dataRow.pmc_contact = row.pmc_contact || '-';
      dataRow.land_owner_name = row.land_owner_name || '-';
      dataRow.land_type = row.land_type || 'Freehold';
      dataRow.cts_survey_no = row.cts_survey_no || '-';
      dataRow.is_society_registered = formatBool(row.is_society_registered);
      dataRow.registration_no = row.registration_no || '-';

      dataRow.chairman_details = formatCommittee(row.chairman_details);
      dataRow.secretary_details = formatCommittee(row.secretary_details);
      dataRow.treasurer_details = formatCommittee(row.treasurer_details);
      dataRow.responsible_person_details = formatCommittee(row.responsible_person_details);

      const extras = parseNestedObj(row.extra_committee_members);
      if (Array.isArray(extras) && extras.length > 0) {
        dataRow.extra_committee_members = extras
          .map(m => `${m.name || 'N/A'} (${m.contact || 'N/A'})`)
          .join(' | ');
      } else {
        dataRow.extra_committee_members = '-';
      }

      dataRow.has_approved_plan = formatBool(row.has_approved_plan);
      dataRow.has_oc = formatBool(row.has_oc);
      dataRow.has_cc = formatBool(row.has_cc);
      dataRow.has_legal_dispute = formatBool(row.has_legal_dispute);
      dataRow.is_mortgaged = formatBool(row.is_mortgaged);
      dataRow.has_redevelopment_interest = formatBool(row.has_redevelopment_interest);
      dataRow.physical_survey_allowed = formatBool(row.physical_survey_allowed);
      dataRow.flat_measure_allowed = formatBool(row.flat_measure_allowed);
      dataRow.physical_survey = row.physical_survey || 'Not Started';
      dataRow.physical_survey_records = row.physical_survey_records || '-';
      dataRow.banner_permission_allowed = formatBool(row.banner_permission_allowed);
      dataRow.hoarding_date = row.hoarding_date ? row.hoarding_date.toString().split('T')[0] : '-';
      dataRow.consent_type = row.consent_type || '-';

      dataRow.has_interest_letter = formatBool(row.has_interest_letter);
      dataRow.society_acknowledgement = formatBool(row.society_acknowledgement);
      dataRow.offer_letter_sent = formatBool(row.offer_letter_sent);
      dataRow.offer_acceptance_letter = formatBool(row.offer_acceptance_letter);
      dataRow.architect_survey_status = row.architect_survey_status || 'Not Started';
      dataRow.sent_to_architect = formatBool(row.sent_to_architect);
      dataRow.sgm_completed = formatBool(row.sgm_completed);
      dataRow.da_agreement_status = row.da_agreement_status || 'Not Started';
      dataRow.project_progress = row.project_progress || 'Not Started';
      dataRow.document_remarks = row.document_remarks || '-';
      dataRow.updated_by_name = row.updated_by_name || 'N/A';
      dataRow.club_id = row.club_id || '-';

      // Checklist parameters parsing
      const dbChecklist = parseNestedObj(row.document_checklist);
      checklistLabels.forEach(label => {
        const key = `checklist_${label.replace(/\s+/g, '_')}`;
        const item = Array.isArray(dbChecklist) ? dbChecklist.find(d => d.label === label) : null;
        
        if (item && item.file_name) {
          dataRow[key] = { text: 'View Document', hyperlink: getS3Hyperlink(item.file_name) };
        } else if (item && item.value === 1) {
          dataRow[key] = 'Shared (No File)';
        } else {
          dataRow[key] = 'Not Shared';
        }
      });

      const appendedRow = worksheet.addRow(dataRow);

      // Embed single uploads links
      const hyperlinkFields = [
        { key: 'approved_plan_file', field: row.approved_plan_file, label: 'View Approved Plan' },
        { key: 'cc_file', field: row.cc_file, label: 'View CC' },
        { key: 'consent_79a_file', field: row.consent_79a_file, label: 'View 79/A Consent' },
        { key: 'interest_letter_file', field: row.interest_letter_file, label: 'View Interest Letter' },
        { key: 'offer_acceptance_letter_file', field: row.offer_acceptance_letter_file, label: 'View Acceptance Letter' }
      ];

      hyperlinkFields.forEach(({ key, field, label }) => {
        if (field) {
          const colIndex = worksheet.getColumn(key).number;
          appendedRow.getCell(colIndex).value = { text: label, hyperlink: getS3Hyperlink(field) };
        } else {
          const colIndex = worksheet.getColumn(key).number;
          appendedRow.getCell(colIndex).value = 'Not Uploaded';
        }
      });

      // Embed multiple offer letter arrays
      const offersArr = parseNestedObj(row.offer_letter_files);
      if (Array.isArray(offersArr) && offersArr.length > 0) {
        const colIndex = worksheet.getColumn('offer_letter_files').number;
        appendedRow.getCell(colIndex).value = { text: `View Offer Letters (${offersArr.length} Files)`, hyperlink: getS3Hyperlink(offersArr[0]) };
      } else {
        const colIndex = worksheet.getColumn('offer_letter_files').number;
        appendedRow.getCell(colIndex).value = 'No Offers Saved';
      }

      // Format styled fonts and colors for grid rows
      const gridRow = worksheet.getRow(appendedRow.number);
      gridRow.height = 20;
      gridRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        
        if (cell.value && typeof cell.value === 'object' && cell.value.hyperlink) {
          cell.font = { name: 'Arial', size: 10, color: { argb: '0000FF' }, underline: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        if (cell.value === 'Not Shared' || cell.value === 'Not Uploaded') {
          cell.font = { name: 'Arial', size: 9, color: { argb: 'A3A3A3' }, italic: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Apply a bold, thick 3-point border on the very first row
        if (rowIndex === 0) {
          cell.border = {
            top: { style: 'medium', color: { argb: '000000' } },
            bottom: { style: 'medium', color: { argb: '000000' } },
            left: { style: 'thin', color: { argb: 'E5E5E5' } },
            right: { style: 'thin', color: { argb: 'E5E5E5' } }
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F2F4F7' }
          };
        } else {
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'E5E5E5' } },
            left: { style: 'thin', color: { argb: 'E5E5E5' } },
            right: { style: 'thin', color: { argb: 'E5E5E5' } }
          };
        }
      });
    });

    // 5. Output response stream buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${finalFileName}"`,
      },
    });

  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: 'Failed to generate excel export file' }, { status: 500 });
  }
}