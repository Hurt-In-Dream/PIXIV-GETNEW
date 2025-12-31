import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// R2 client singleton
let r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
    if (r2Client) return r2Client;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('Missing R2 environment variables');
    }

    r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });

    return r2Client;
}

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * Upload image buffer to R2
 * @param buffer - Image buffer to upload
 * @param key - Object key (path in bucket)
 * @param contentType - MIME type of the image
 */
export async function uploadToR2(
    buffer: Buffer,
    key: string,
    contentType: string = 'image/jpeg'
): Promise<UploadResult> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!bucketName || !publicUrl) {
        return { success: false, error: 'Missing R2 bucket configuration' };
    }

    try {
        const client = getR2Client();

        await client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            })
        );

        // Construct public URL
        const url = `${publicUrl.replace(/\/$/, '')}/${key}`;

        return { success: true, url };
    } catch (error) {
        console.error('R2 upload error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown upload error',
        };
    }
}

/**
 * Generate a unique key for storing images in R2
 * @param pid - Pixiv illustration ID
 * @param page - Page number (for multi-page illustrations)
 * @param extension - File extension
 */
export function generateR2Key(pid: number, page: number = 0, extension: string = 'jpg'): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `pixiv/${year}/${month}/${pid}_p${page}.${extension}`;
}
