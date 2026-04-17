/**
 * Utility to validate property form data before DB insertion.
 * Returns an object: { isValid: boolean, errors: Object }
 */

// Regex Helpers
const PHONE_REGEX = /^[\d\s\-\+\(\)]{10,15}$/; // Allows 10-15 chars (digits, spaces, +)

export const validatePropertyForm = (data) => {
    const errors = {};

    // 1. MANDATORY DB FIELDS (Cannot be blank)

    if (!data.property_name || data.property_name.trim().length < 3) {
        errors.property_name = "Property Name is required and must be at least 3 characters.";
    }

    if (!data.status) {
        errors.status = "Overall Status is required.";
    }

    if (!data.lat || !data.lng || data.lat === 0 || data.lng === 0) {
        errors.location = "Valid map coordinates (Latitude & Longitude) are required.";
    }

    // --- ME FIX: New Mandatory Fields Added Below ---

    if (!data.address || data.address.trim().length < 5) {
        errors.address = "Full Property Address is required.";
    }

    if (!data.pmc_name || data.pmc_name.trim().length < 3) {
        errors.pmc_name = "PMC / Co-ordinator Name is required.";
    }

    // PMC Contact is now strictly mandatory AND must pass format validation
    if (!data.pmc_contact || !PHONE_REGEX.test(data.pmc_contact)) {
        errors.pmc_contact = "A valid PMC Contact Number (10-15 digits) is strictly required.";
    }

    // 2. DATA TYPE & FORMAT RESTRICTIONS (If provided)

    // Numbers (Total Flats & Shops)
    if (data.total_flats && (isNaN(data.total_flats) || Number(data.total_flats) < 0)) {
        errors.total_flats = "Total Flats must be a positive number.";
    }

    if (data.total_shops && (isNaN(data.total_shops) || Number(data.total_shops) < 0)) {
        errors.total_shops = "Total Shops must be a positive number.";
    }

    // 3. COMMITTEE CONTACT VALIDATIONS 

    // These are optional, but IF entered, they must be valid phone numbers
    const validateContact = (contactObj, fieldName) => {
        if (contactObj?.contact && !PHONE_REGEX.test(contactObj.contact)) {
            // Clean up the field name for the error message (e.g., 'chairman_details' -> 'chairman')
            const cleanName = fieldName.replace('_details', '').charAt(0).toUpperCase() + fieldName.replace('_details', '').slice(1);
            errors[fieldName] = `Valid phone number required for ${cleanName}.`;
        }
    };

    validateContact(data.chairman_details, 'chairman_details');
    validateContact(data.secretary_details, 'secretary_details');
    validateContact(data.treasurer_details, 'treasurer_details');
    validateContact(data.responsible_person_details, 'responsible_person_details');

    // Extra Committee Members Validation
    if (Array.isArray(data.extra_committee_members)) {
        data.extra_committee_members.forEach((member, index) => {
            if (member.contact && !PHONE_REGEX.test(member.contact)) {
                errors[`extra_member_${index}`] = `Valid phone number required for Extra Member ${index + 1}.`;
            }
        });
    }

    // 4. DATE LOGIC VALIDATIONS
    if (data.offer_acceptance_date && data.offer_letter_status !== 'Accepted') {
        errors.offer_acceptance_date = "Acceptance date can only be logged if status is 'Accepted'.";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};