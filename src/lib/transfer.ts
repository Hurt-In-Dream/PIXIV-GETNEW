/**
 * Image Transfer Orchestrator
 * Handles the complete flow: check duplicates -> download -> upload to R2 -> save metadata
 */

import { createServerClient, type PixivImage } from './supabase';
import { uploadToR2, generateR2Key, getImageOrientation } from './r2';
import {
    getImageInfo,
    downloadImage,
    getRanking,
    searchByTag,
    getRelatedWorks,
    type PixivIllust,
} from './pixiv';
import { delay } from './utils';
import { logInfo, logSuccess, logWarning, logError } from './logger';

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
        await logInfo(`跳过已存在: PID ${pid}`);
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

    // Determine image orientation (h = horizontal/landscape, v = vertical/portrait)
    const orientation = getImageOrientation(info.width, info.height);

    // Check if it's R18
    const isR18 = info.tags.some(tag => tag.toLowerCase() === 'r-18' || tag.toLowerCase() === 'r18');

    // Upload to R2 with orientation-based folder structure (and R18 prefix if applicable)
    const r2Key = generateR2Key(pid, orientation, image.extension, isR18);
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
        await logError(`保存元数据失败: PID ${pid}`);
        return { success: false, skipped: false, error: 'Failed to save metadata' };
    }

    await logSuccess(`成功抓取: ${info.title}`, `PID: ${pid}, 作者: ${info.artist}`);
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
                await logError(`处理失败: PID ${pid}`, result.error);
            }
        } catch (error) {
            progress.failed++;
            await logError(`处理异常: PID ${pid}`, error instanceof Error ? error.message : String(error));
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
 * Tags that indicate images to skip (no background, manga, or AI generated)
 */
const SKIP_TAGS = [
    // Transparent/no background
    '透過png', '透明背景', 'transparent', 'transparent_background', 'png',
    // Simple/solid color backgrounds  
    '白背景', '白バック', 'white_background', 'simple_background',
    '単色背景', 'solid_background', 'grey_background', 'gray_background',
    // Chibi/SD style (usually have simple backgrounds)
    'ちびキャラ', 'chibi', 'SD', 'ミニキャラ', 'デフォルメ',
    // Character design sheets
    'キャラクターデザイン', 'character_design', '立ち絵', 'character_sheet',
    // Other indicators of minimal backgrounds
    'シンプル', 'simple', '落書き', 'sketch', 'doodle',
    // Manga/Comics (not suitable for backgrounds)
    '漫画', 'manga', 'comic', 'コミック', '4コマ',
    // AI Generated
    'AI生成', 'AI-generated', 'novelai', 'midjourney', 'stable_diffusion', 'ai_generated', 'aiイラスト',
];

/**
 * Check if an illustration should be skipped based on tags
 */
function shouldSkipByTags(tags: string[]): boolean {
    const lowerTags = tags.map(t => t.toLowerCase());
    return SKIP_TAGS.some(skipTag =>
        lowerTags.some(tag => tag.includes(skipTag.toLowerCase()))
    );
}

/**
 * Crawl and transfer images from ranking
 * Balances horizontal and vertical images 1:1 ratio
 * Filters out images with no/simple backgrounds
 */
export async function crawlRanking(
    mode: string = 'daily',
    limit: number = BATCH_SIZE,
    balanceOrientation: boolean = true
): Promise<TransferResult> {
    await logInfo(`开始抓取排行榜`, `模式: ${mode}, 数量: ${limit}`);
    const result = await getRanking(mode, 1);

    if (!result.success) {
        return {
            success: false,
            progress: { total: 0, processed: 0, success: 0, failed: 0, skipped: 0 },
            error: result.error,
        };
    }

    let selectedIllusts: typeof result.illustrations = [];

    if (balanceOrientation) {
        const halfLimit = Math.ceil(limit / 2);
        const horizontalIllusts: typeof result.illustrations = [];
        const verticalIllusts: typeof result.illustrations = [];

        // Separate images by orientation, filtering out bad backgrounds
        for (const illust of result.illustrations) {
            // Skip images with transparent/simple background tags
            if (shouldSkipByTags(illust.tags)) {
                continue;
            }

            if (!illust.width || !illust.height) {
                // Unknown dimensions - add to vertical as default
                if (verticalIllusts.length < halfLimit) {
                    verticalIllusts.push(illust);
                }
                continue;
            }

            const ratio = illust.width / illust.height;

            if (ratio > 1.0) {
                // Horizontal (landscape)
                if (horizontalIllusts.length < halfLimit) {
                    horizontalIllusts.push(illust);
                }
            } else {
                // Vertical (portrait) or square
                if (verticalIllusts.length < halfLimit) {
                    verticalIllusts.push(illust);
                }
            }

            // Stop if we have enough of both
            if (horizontalIllusts.length >= halfLimit && verticalIllusts.length >= halfLimit) {
                break;
            }
        }

        selectedIllusts = [...horizontalIllusts, ...verticalIllusts];
        await logInfo(
            `平衡筛选完成`,
            `横屏: ${horizontalIllusts.length}张, 竖屏: ${verticalIllusts.length}张`
        );
    } else {
        // No balancing, just filter out bad backgrounds
        selectedIllusts = result.illustrations.filter(i => !shouldSkipByTags(i.tags)).slice(0, limit);
    }

    return processBatch(selectedIllusts);
}

/**
 * Crawl and transfer images by tag
 * Also filters out images with no/simple backgrounds
 */
export async function crawlByTag(
    tag: string,
    limit: number = BATCH_SIZE,
    balanceOrientation: boolean = true
): Promise<TransferResult> {
    await logInfo(`开始按标签抓取`, `标签: ${tag}, 数量: ${limit}`);
    const result = await searchByTag(tag, 1);

    if (!result.success) {
        return {
            success: false,
            progress: { total: 0, processed: 0, success: 0, failed: 0, skipped: 0 },
            error: result.error,
        };
    }

    // Filter out bad backgrounds and balance orientation
    let selectedIllusts: typeof result.illustrations = [];

    if (balanceOrientation) {
        const halfLimit = Math.ceil(limit / 2);
        const horizontalIllusts: typeof result.illustrations = [];
        const verticalIllusts: typeof result.illustrations = [];

        for (const illust of result.illustrations) {
            if (shouldSkipByTags(illust.tags)) continue;

            const ratio = (illust.width && illust.height) ? illust.width / illust.height : 0.8;

            if (ratio > 1.0 && horizontalIllusts.length < halfLimit) {
                horizontalIllusts.push(illust);
            } else if (ratio <= 1.0 && verticalIllusts.length < halfLimit) {
                verticalIllusts.push(illust);
            }

            if (horizontalIllusts.length >= halfLimit && verticalIllusts.length >= halfLimit) break;
        }

        selectedIllusts = [...horizontalIllusts, ...verticalIllusts];
    } else {
        selectedIllusts = result.illustrations.filter(i => !shouldSkipByTags(i.tags)).slice(0, limit);
    }

    return processBatch(selectedIllusts);
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
