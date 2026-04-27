/**
 * Utility to safely parse JSON strings back to objects
 */
const safeParse = (data) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try { return JSON.parse(data); } catch { return {}; }
};

/**
 * Utility to format Yes/No flags
 */
const toYesNo = (val) => (val === 1 || val === '1' || val === true ? 'Yes' : 'No');

/**
 * Utility to escape strings for CSV format (handles commas and newlines)
 */
const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const cleanStr = String(str).replace(/"/g, '""'); // Escape double quotes
    return `"${cleanStr}"`; // Wrap in double quotes
};

/**
 * Exports all property data to a CSV file.
 */
export const exportPropertiesToExcel = (properties) => {
    if (!properties || properties.length === 0) return false;

    // Define all comprehensive headers
    const headers = [
        "Property ID", "Status", "Category", "Property/Building Name", "Locality", "Full Address",
        "Latitude", "Longitude", "PMC Name", "PMC Contact", "Assigned Manager ID", "Assigned Manager Name", "Assigned CP ID", "Assigned CP Name",
        "Land Owner Name", "Land Type", "CTS/Survey No", "Society Registered?", "Registration No",
        "Total Plot Area", "Total Flats", "Total Shops", "Total Flat Area Combined",
        "Chairman Name", "Chairman Contact", "Secretary Name", "Secretary Contact", 
        "Treasurer Name", "Treasurer Contact", "Responsible Person Name", "Responsible Person Contact",
        "Has Approved Plan?", "Has OC?", "Has CC?", "Has Legal Dispute?", "Is Mortgaged?", 
        "Redevelopment Interest?", "Flat Measurement Allowed?", "Physical Survey Status", 
        "Physical Survey Records", "Banner Permission Allowed?", "Hoarding Date",
        "Interest Letter Submitted?", "Architect Submitted?", "Interaction History", 
        "Offer Letter Status", "Offer Meeting Track", "Offer Acceptance Date", 
        "SGM Completed?", "DA Agreement Status", "Created At", "Last Updated By"
    ];

    // Map each property to a row matching the headers
    const rows = properties.map(p => {
        const chair = safeParse(p.chairman_details);
        const sec = safeParse(p.secretary_details);
        const treas = safeParse(p.treasurer_details);
        const resp = safeParse(p.responsible_person_details);

        return [
            p.id, p.status, p.category, p.property_name, p.locality, p.address,
            p.lat, p.lng, p.pmc_name, p.pmc_contact, p.assigned_admin_id, (p.assigned_admin_name || p.admin_name || p.manager_name || ''), p.assigned_cp_id, (p.assigned_cp_name || p.cp_name || ''),
            p.land_owner_name, p.land_type, p.cts_survey_no, toYesNo(p.is_society_registered), p.registration_no,
            p.total_plot_area, p.total_flats, p.total_shops, p.total_flat_area_combined,
            chair.name, chair.contact, sec.name, sec.contact, 
            treas.name, treas.contact, resp.name, resp.contact,
            toYesNo(p.has_approved_plan), toYesNo(p.has_oc), toYesNo(p.has_cc), toYesNo(p.has_legal_dispute), toYesNo(p.is_mortgaged),
            toYesNo(p.has_redevelopment_interest), toYesNo(p.flat_measure_allowed), p.physical_survey,
            p.physical_survey_records, toYesNo(p.banner_permission_allowed), p.hoarding_date,
            toYesNo(p.has_interest_letter), toYesNo(p.architect_submitted), p.interaction_history,
            p.offer_letter_status, p.offer_meeting_track, p.offer_acceptance_date,
            toYesNo(p.sgm_completed), p.da_agreement_status, p.created_at, (p.updated_by_name || p.updated_by_email || 'Unknown')
        ].map(escapeCSV); // Escape every field automatically
    });

    // Build the CSV string
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    // Trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AsmitA_Properties_Master_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
};