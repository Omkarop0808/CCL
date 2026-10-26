import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sahaya-storage-omkar-2026';

let _s3Client = null;

function getClient() {
  if (!_s3Client) {
    _s3Client = new S3Client({ region: REGION });
  }
  return _s3Client;
}

/**
 * Uploads a file (Buffer or filepath) to Amazon S3.
 * Returns the S3 Key and S3 URI.
 */
export async function uploadToS3({ filePath, fileBuffer, key, contentType = 'application/pdf' }) {
  try {
    const body = fileBuffer || (filePath ? fs.readFileSync(filePath) : null);
    if (!body) throw new Error('No file buffer or path provided for S3 upload.');

    const client = getClient();
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await client.send(command);
    const s3Uri = `s3://${BUCKET_NAME}/${key}`;
    const s3Url = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;

    console.log(`[Amazon S3] Successfully uploaded: ${s3Uri}`);
    return {
      success: true,
      bucket: BUCKET_NAME,
      key,
      s3Uri,
      s3Url,
    };
  } catch (err) {
    console.error(`[Amazon S3] Upload failed for ${key}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Deletes an object from Amazon S3.
 */
export async function deleteFromS3(key) {
  try {
    const client = getClient();
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await client.send(command);
    console.log(`[Amazon S3] Deleted object: ${key}`);
    return true;
  } catch (err) {
    console.warn(`[Amazon S3] Failed to delete ${key}:`, err.message);
    return false;
  }
}
