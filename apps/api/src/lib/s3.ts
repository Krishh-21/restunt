import './loadEnv';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_BUCKET_NAME;
function requiredBucket(){if(!bucketName)throw new Error('AWS_BUCKET_NAME is not configured');return bucketName;}

export const s3Client = new S3Client({
  region,
  // Standard AWS chain supports instance roles, web identity, profiles and env keys.

});

/**
 * Uploads a file to S3 with AES-256 server-side encryption.
 */
export async function uploadToS3(
  key: string,
  body: Buffer | string,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: requiredBucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });

  await s3Client.send(command);

  // If CloudFront URL is configured, return it, otherwise default S3 URL
  const cloudFrontUrl = process.env.CLOUDFRONT_URL;
  if (cloudFrontUrl) {
    return `${cloudFrontUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Generates a presigned URL to download/view a file securely.
 */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: requiredBucket(),
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
