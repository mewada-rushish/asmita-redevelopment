import { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    forcePathStyle: false,
    region: "sgp1",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});

export async function promoteDraftFiles(draftFolderId, newPropertyId, propertyName) {
    const bucket = process.env.DO_SPACES_BUCKET;
    const safePropName = propertyName ? propertyName.replace(/[^a-z0-9\s-]/gi, '').trim() : 'Unnamed_Property';

    const oldPrefix = `asmita-redevelopment/${draftFolderId}/`;
    const newPrefix = `asmita-redevelopment/${newPropertyId} - ${safePropName}/`;

    const listCmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: oldPrefix });
    const listRes = await s3Client.send(listCmd);

    if (!listRes.Contents || listRes.Contents.length === 0) return;

    await Promise.all(listRes.Contents.map(async (item) => {
        const oldKey = item.Key;
        const newKey = oldKey.replace(oldPrefix, newPrefix);

        // STRICT ENCODING FOR DIGITALOCEAN: Encode everything but the slashes
        const sourceUrl = `${bucket}/${oldKey}`;
        const encodedCopySource = encodeURIComponent(sourceUrl).replace(/%2F/g, '/');

        await s3Client.send(new CopyObjectCommand({
            Bucket: bucket,
            CopySource: encodedCopySource,
            Key: newKey,
            ACL: 'public-read'
        }));

        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: oldKey
        }));
    }));
}