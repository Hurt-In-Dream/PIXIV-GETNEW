/**
 * Image Transfer Orchestrator
 * Handles the complete flow: check duplicates -> download -> upload to R2 -> save metadata
 */

import { createServerClient, type PixivImage } from './supabase';
import { uploadToR2, generateR2Key } from './r2';
import {
    getImageInfo,
    downloadImage,
    getRanking,
    searchByTag,
    getRelatedWorks,
    type PixivIllust,
} from './pixiv';
import { delay } from './utils';

export interface TransferProgress {
    total: number;
    processed: number;
    success: number;
    failed: number;
    skipped: number;
    current?: string;
}

export interface TransferResult {
    success: boolean;
    progress: TransferProgress;
    error?: string;
}

// Batch size to prevent Vercel timeout
const BATCH_SIZE = 5;
const DELAY_BETWEEN_DOWNLOADS = 500; // ms

/**
 * Check if a PID already exists in database
 */
export async function checkDuplicate(pid: number): Promise<boolean> {
    const supabase = createServerClient();

    const { data, error } = await supabase
        .from('pixiv_images')
        .select('id')
        .eq('pid', pid)
        .limit(1);

    if (error) {
        console.error('Error checking duplicate:', error);
        return false;
    }

    return data && data.length > 0;
}

/**
 * Save image metadata to Supabase
 */
export async function saveImageMetadata(
    image: Omit<PixivImage, 'id' | 'created_at'>
): Promise<boolean> {
    const supabase = createServerClient();

    const { error } = await supabase
        .from('pixiv_images')
        .upsert({
            pid: image.pid,
            title: image.title,
            artist: image.artist,
            tags: image.tags,
            original_url: image.original_url,
            r2_url: image.r2_url,
        }, {
            onConflict: 'pid',
        });

    if (error) {
        console.error('Error saving metadata:', error);
        return false;
    }

    return true;
}

/**
 * Process a single illustration: download, upload to R2, save metadata
 */
export async function processIllustration(pid: number): Promise<{
    success: boolean;
    skipped: boolean;
    error?: string;
}> {
    // Check for duplicates
    const isDuplicate = await checkDuplicate(pid);
    if (isDuplicate) {
        console.log(`PID ${pid} already exists, skipping...`);
        return { success: true, skipped: true };
    }

    // Get image info
    const info = await getImageInfo(pid);
    if (!info || info.originalUrls.length === 0) {
        return { success: false, skipped: false, error: 'Failed to get image info' };
    }

    // Download first page only (to save bandwidth and time)
    const firstUrl = info.originalUrls[0];
    const image = await downloadImage(firstUrl, pid, 0);

    if (!image) {
        return { success: false, skipped: false, error: 'Failed to download image' };
    }

    // Upload to R2
    const r2Key = generateR2Key(pid, 0, image.extension);
    const uploadResult = await uploadToR2(image.buffer, r2Key, image.contentType);

    if (!uploadResult.success) {
        return { success: false, skipped: false, error: uploadResult.error };
    }

    // Save metadata
    const saved = await saveImageMetadata({
        pid,
        title: info.title,
        artist: info.artist,
        tags: info.tags,
        original_url: firstUrl,
        r2_url: uploadResult.url || null,
    });

    if (!saved) {
        return { success: false, skipped: false, error: 'Failed to save metadata' };
    }

    return { success: true, skipped: false };
}

/**
 * Process a batch of illustrations
 */
export async function processBatch(
    illustrations: PixivIllust[],
    onProgress?: (progress: TransferProgress) => void
): Promise<TransferResult> {
    const progress: TransferProgress = {
        total: illustrations.length,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
    };

    for (const illust of illustrations) {
        const pid = parseInt(illust.id);
        progress.current = `Processing PID ${pid}: ${illust.title}`;

        if (onProgress) {
            onProgress({ ...progress });
        }

        try {
            const result = await processIllustration(pid);

            if (result.skipped) {
                progress.skipped++;
            } else if (result.success) {
                progress.success++;
            } else {
                progress.failed++;
                console.error(`Failed to process PID ${pid}:`, result.error);
            }
        } catch (error) {
            progress.failed++;
            console.error(`Error processing PID ${pid}:`, error);
        }

        progress.processed++;

        // Add delay to avoid rate limiting
        await delay(DELAY_BETWEEN_DOWNLOADS);
    }

    return {
        success: progress.failed === 0,
        progress,
    };
}

/**
 * Crawl and transfer images from ranking
 */
export async function crawlRanking(
    mode: string = 'daily',
    limit: number = BATCH_SIZE
): Promise<TransferResult> {
    const result = await getRanking(mode, 1);

    if (!result.success) {
        return {
            success: false,
            progress: { total: 0, processed: 0, success: 0, failed: 0, skipped: 0 },
            error: result.error,
        };
    }

    const batch = result.illustrations.slice(0, limit);
    return processBatch(batch);
}

/**
 * Crawl and transfer images by tag
 */
export async function crawlByTag(
    tag: string,
    limit: number = BATCH_SIZE
): Promise<TransferResult> {
    const result = await searchByTag(tag, 1);

    if (!result.success) {
        return {
            success: false,
            progress: { total: 0, processed: 0, success: 0, failed: 0, skipped: 0 },
            error: result.error,
        };
    }

    const batch = result.illustrations.slice(0, limit);
    return processBatch(batch);
}

/**
 * Crawl and transfer related works for a PID
 */
export async function crawlRelated(
    pid: number,
    limit: number = BATCH_SIZE
): Promise<TransferResult> {
    // First process the original PID
    const originalResult = await processIllustration(pid);

    // Then get related works
    const result = await getRelatedWorks(pid, limit);

    if (!result.success) {
        return {
            success: originalResult.success,
            progress: {
                total: 1,
                processed: 1,
                success: originalResult.success ? 1 : 0,
                failed: originalResult.success ? 0 : 1,
                skipped: originalResult.skipped ? 1 : 0
            },
            error: result.error,
        };
    }

    const batch = result.illustrations.slice(0, limit);
    const batchResult = await processBatch(batch);

    // Combine results
    batchResult.progress.total += 1;
    batchResult.progress.processed += 1;
    if (originalResult.skipped) {
        batchResult.progress.skipped += 1;
    } else if (originalResult.success) {
        batchResult.progress.success += 1;
    } else {
        batchResult.progress.failed += 1;
    }

    return batchResult;
}
