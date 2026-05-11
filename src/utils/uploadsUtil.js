const ALLOWED_FILE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
];

export const uploadPropertyDocument = async (file, propertyId, propertyName, fileLabel, previousFileKey = null) => {
    try {
        if (!file) throw new Error("No file selected.");

        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            throw new Error("Invalid file type. Only PNG, JPG, WEBP, and PDF files are allowed.");
        }

        const extension = file.name.split('.').pop();
        const contentType = file.type || 'application/octet-stream';

        const apiRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                propertyId,
                propertyName, 
                fileLabel,
                contentType,
                extension,
                previousFileKey
            })
        });

        const apiData = await apiRes.json();

        if (!apiRes.ok || !apiData.success) {
            throw new Error(apiData.error || "Failed to obtain secure upload ticket.");
        }

        const uploadRes = await fetch(apiData.signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': contentType,
                'x-amz-acl': 'public-read'
            }
        });

        if (!uploadRes.ok) {
            throw new Error("Failed to transfer file to cloud storage.");
        }

        return {
            success: true,
            fileKey: apiData.fileKey,
            publicUrl: apiData.publicUrl
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || "An unexpected error occurred during upload."
        };
    }
};