import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

async function verifyAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('asmita_auth')?.value;
    if (!token) return false;
    try { return jwt.verify(token, process.env.JWT_SECRET); }
    catch (e) { return false; }
}

const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    forcePathStyle: false,
    region: "sgp1",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});

export async function POST(req) {
    try {
        const auth = await verifyAuth();
        if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { propertyId, propertyName, fileLabel, contentType, extension } = await req.json();

        if (!fileLabel || !contentType) {
            return NextResponse.json({ error: "Missing file metadata" }, { status: 400 });
        }

        const safePropName = propertyName ? propertyName.replace(/[^a-z0-9\s-]/gi, '').trim() : 'Unnamed_Property';
        const folderId = propertyId ? `${propertyId} - ${safePropName}` : `draft-${Date.now()} - ${safePropName}`;

        // Use a unique timestamp to guarantee files are never overwritten and CDN cache is busted
        const safeLabel = fileLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
        const uniqueFileKey = `asmita-redevelopment/${folderId}/${safeLabel}-${timestamp}.${extension}`;

        // Upload the new file directly. 
        const command = new PutObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: uniqueFileKey,
            ContentType: contentType,
            ACL: 'public-read',
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        // Construct the public URL dynamically using the endpoint and bucket
        let cleanEndpoint = process.env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, '');
        if (cleanEndpoint.endsWith('/')) cleanEndpoint = cleanEndpoint.slice(0, -1);
        const publicUrl = `https://${process.env.DO_SPACES_BUCKET}.${cleanEndpoint}/${uniqueFileKey}`;

        return NextResponse.json({
            success: true,
            signedUrl,
            publicUrl,
            fileKey: uniqueFileKey
        });

    } catch (error) {
        console.error("DO Spaces Presign Error:", error);
        return NextResponse.json({ error: "Failed to initialize upload" }, { status: 500 });
    }
}