import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// Validate env vars
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.warn("Cloudflare R2 credentials are not fully configured in environment variables.");
}

export const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
    },
});

/**
 * Generate a pre-signed URL for direct browser-to-R2 file upload
 * @param contentType The MIME type of the file being uploaded
 * @param originalFilename The original name of the file
 * @returns An object containing the pre-signed URL and the unique object key
 */
export async function generatePresignedUploadUrl(contentType: string, originalFilename: string) {
    // Generate a unique, safe key for the file to prevent collisions
    const extension = originalFilename.split('.').pop() || '';
    const safeFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `sarvagya-docs/${uuidv4()}-${safeFilename}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: contentType,
        // Optional: you can set ACL or metadata here if needed
    });

    // The URL expires in 15 minutes
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    return {
        uploadUrl: signedUrl,
        objectKey: objectKey,
    };
}

/**
 * Upload a raw Buffer directly to R2 from the backend (e.g. Workers)
 * @param buffer The file Buffer to upload
 * @param contentType The MIME type of the file
 * @param originalFilename The original or generated name of the file
 * @returns The unique object key where the file was stored
 */
export async function uploadBufferToR2(buffer: Buffer, contentType: string, originalFilename: string) {
    const safeFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const objectKey = `sarvagya-audio/${uuidv4()}-${safeFilename}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
    });

    await r2Client.send(command);
    return objectKey;
}

/**
 * Upload a canonical source document at an explicit key.
 *
 * Unlike `uploadBufferToR2`, this does NOT invent the key — the caller owns it.
 * Trio source files are keyed by canonical identity as
 * `content/{content_item_id}/source.pdf`, deliberately matching neither DCP's
 * `sarvagya-*` prefixes nor PDLMS's `global/books/{bookId}/`: the bucket is
 * shared between both apps, so extending either legacy convention would tie the
 * shared content schema to one app's history. This namespace collides with
 * nothing and is what a future Content Service can adopt unchanged.
 *
 * @returns the bucket and key actually written, for `r2://{bucket}/{key}`
 */
export async function uploadSourceDocumentToR2(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
}): Promise<{ bucket: string; key: string }> {
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME is not set — cannot store the canonical source document.');
  }
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.contentType,
    }),
  );
  return { bucket: bucketName, key: params.key };
}

/**
 * Generate a pre-signed URL to read a file from R2
 * @param objectKey The key of the object to download/read
 */
export async function generatePresignedDownloadUrl(objectKey: string) {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
    });

    // The URL expires in 1 hour
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    return signedUrl;
}
