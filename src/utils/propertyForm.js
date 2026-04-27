const PHONE_REGEX = /^[\d\s\-\+\(\)]{10,15}$/;

export const validatePropertyForm = (data) => {
    const errors = {};

    if (!data.property_name || data.property_name.trim().length < 3) {
        errors.property_name = "Property Name is required and must be at least 3 characters.";
    }

    if (!data.status) {
        errors.status = "Overall Status is required.";
    }

    if (!data.lat || !data.lng || data.lat === 0 || data.lng === 0) {
        errors.location = "Valid map coordinates (Latitude & Longitude) are required.";
    }

    if (!data.address || data.address.trim().length < 5) {
        errors.address = "Full Property Address is required.";
    }

    if (!data.pmc_name || data.pmc_name.trim().length < 3) {
        errors.pmc_name = "PMC / Co-ordinator Name is required.";
    }

    if (!data.pmc_contact || !PHONE_REGEX.test(data.pmc_contact)) {
        errors.pmc_contact = "A valid PMC Contact Number (10-15 digits) is strictly required.";
    }

    if (data.total_flats && (isNaN(data.total_flats) || Number(data.total_flats) < 0)) {
        errors.total_flats = "Total Flats must be a positive number.";
    }

    if (data.total_shops && (isNaN(data.total_shops) || Number(data.total_shops) < 0)) {
        errors.total_shops = "Total Shops must be a positive number.";
    }

    const validateContact = (contactObj, fieldName) => {
        if (contactObj?.contact && !PHONE_REGEX.test(contactObj.contact)) {
            const cleanName = fieldName.replace('_details', '').charAt(0).toUpperCase() + fieldName.replace('_details', '').slice(1);
            errors[fieldName] = `Valid phone number required for ${cleanName}.`;
        }
    };

    validateContact(data.chairman_details, 'chairman_details');
    validateContact(data.secretary_details, 'secretary_details');
    validateContact(data.treasurer_details, 'treasurer_details');
    validateContact(data.responsible_person_details, 'responsible_person_details');

    if (Array.isArray(data.extra_committee_members)) {
        data.extra_committee_members.forEach((member, index) => {
            if (member.contact && !PHONE_REGEX.test(member.contact)) {
                errors[`extra_member_${index}`] = `Valid phone number required for Extra Member ${index + 1}.`;
            }
        });
    }

    if (data.offer_acceptance_date && data.offer_letter_status !== 'Accepted') {
        errors.offer_acceptance_date = "Acceptance date can only be logged if status is 'Accepted'.";
    }

    if (data.has_interest_letter === 1 && !data.interest_letter_file) {
        errors.interest_letter = "Interest Letter is marked as 'YES' but no file was uploaded.";
    }

    if (Array.isArray(data.document_checklist)) {
        data.document_checklist.forEach((item, index) => {
            if (item.value === 1 && !item.file_name) {
                const docName = item.label ? item.label.replace('Bulk: ', '') : `Document #${index + 1}`;
                errors[`document_${index}`] = `'${docName}' is marked as 'YES' but no file was uploaded.`;
            }
        });
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};