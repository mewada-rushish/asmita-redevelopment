import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    forcePathStyle: false,
    region: "sgp1",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});

export async function GET(req) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('asmita_auth')?.value;

        if (!token) {
            return new NextResponse('Unauthorized: No session', { status: 401 });
        }
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return new NextResponse('Unauthorized: Invalid token', { status: 403 });
        }
    
        const { searchParams } = new URL(req.url);
        const key = searchParams.get('key');

        if (!key) {
            return new NextResponse('Bad Request: File key is required', { status: 400 });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: key,
            ResponseContentDisposition: 'inline'
        });
    
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
        return NextResponse.redirect(signedUrl);

    } catch (error) {
        console.error('ERROR [viewDoc API]:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}