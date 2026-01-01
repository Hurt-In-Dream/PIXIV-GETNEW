import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

export type ImageOrientation = 'h' | 'v'; // horizontal or vertical
export type ImageSource = 'ranking' | 'tag'; // source of image

/**
 * Generate a unique key for storing images in R2
 * Organizes by orientation (h/v) and uses date+pid naming
 * @param pid - Pixiv illustration ID
 * @param orientation - 'h' for horizontal (landscape), 'v' for vertical (portrait)
 * @param extension - File extension
 * @param isR18 - Whether the image is R18
 * @param source - 'ranking' or 'tag' to determine folder
 */
export function generateR2Key(
    pid: number,
    orientation: ImageOrientation = 'v',
    extension: string = 'jpg',
    isR18: boolean = false,
    source: ImageSource = 'ranking'
): string {
    const date = new Date();
    const dateStr = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('');

    // Build path: [R18/][tag/]h/ or [R18/][tag/]v/
    let prefix = '';
    if (isR18) prefix += 'R18/';
    if (source === 'tag') prefix += 'tag/';

    // Format: [R18/][tag/]h/20260101_123456789.jpg
    return `${prefix}${orientation}/${dateStr}_${pid}.${extension}`;
}

/**
 * Determine image orientation based on dimensions
 * @param width - Image width
 * @param height - Image height
 * @returns 'h' for horizontal/landscape, 'v' for vertical/portrait
 */
export function getImageOrientation(width: number, height: number): ImageOrientation {
    return width > height ? 'h' : 'v';
}
