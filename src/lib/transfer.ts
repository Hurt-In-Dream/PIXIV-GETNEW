/**
 * Image Transfer Orchestrator
 * Handles the complete flow: check duplicates -> download -> upload to R2 -> save metadata
 */

import { createServerClient, type PixivImage } from './supabase';
import { uploadToR2, generateR2Key, getImageOrientation, type ImageSource } from './r2';
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

// Minimum resolution for "Wallpaper Quality"
const MIN_WIDTH = 1200;
const MIN_HEIGHT = 1200;

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
 * @param pid - Pixiv illustration ID
 * @param source - 'ranking' or 'tag' to determine storage folder
 */
export async function processIllustration(
    pid: number,
    source: ImageSource = 'ranking'
): Promise<{
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

    // Upload to R2 with orientation-based folder structure (and R18/tag prefix if applicable)
    const r2Key = generateR2Key(pid, orientation, image.extension, isR18, source);
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
 * @param illustrations - Array of illustrations to process
 * @param source - 'ranking' or 'tag' to determine storage folder
 * @param onProgress - Optional progress callback
 */
export async function processBatch(
    illustrations: PixivIllust[],
    source: ImageSource = 'ranking',
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
            const result = await processIllustration(pid, source);

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
 * Default skip tags (fallback if database is unavailable)
 */
const DEFAULT_SKIP_TAGS = [
    '透過png', '透明背景', '白背景', '単色背景',
    'ちびキャラ', 'chibi', 'SD',
    '漫画', 'manga', 'comic', '4コマ',
    'AI生成', 'novelai',
    'モノクロ', '白黒',
    'log', 'ログ', 'まとめ',
    '色紙', 'VTuber', 'にじさんじ',
    'users入り', '落書き', 'sketch', 'ドット絵',
];

// Cache for skip tags from database
let skipTagsCache: string[] | null = null;
let skipTagsCacheTime: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get skip tags from database or cache
 */
async function getSkipTags(): Promise<string[]> {
    const now = Date.now();

    // Return cached tags if still valid
    if (skipTagsCache && (now - skipTagsCacheTime) < CACHE_TTL) {
        return skipTagsCache;
    }

    try {
        const supabase = createServerClient();
        const { data, error } = await supabase
            .from('skip_tags')
            .select('tag');

        if (error || !data || data.length === 0) {
            return DEFAULT_SKIP_TAGS;
        }

        skipTagsCache = data.map(row => row.tag);
        skipTagsCacheTime = now;
        return skipTagsCache;
    } catch {
        return DEFAULT_SKIP_TAGS;
    }
}

/**
 * Check if an illustration should be skipped based on tags
 */
async function shouldSkipByTags(illustTags: string[], skipTags?: string[]): Promise<boolean> {
    const tagsToCheck = skipTags || await getSkipTags();
    const lowerTags = illustTags.map(t => t.toLowerCase());
    return tagsToCheck.some(skipTag =>
        lowerTags.some(tag => tag.includes(skipTag.toLowerCase()))
    );
}

/**
 * Crawl and transfer images from ranking
 * Balances horizontal and vertical images at 1.5:1 ratio (more horizontal for wide screens)
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

    // Pre-load skip tags for efficiency
    const skipTags = await getSkipTags();

    let selectedIllusts: typeof result.illustrations = [];

    if (balanceOrientation) {
        // Target ratio: 1.5:1 (horizontal:vertical)
        // For limit 30: 18 horizontal, 12 vertical
        const horizontalTarget = Math.ceil(limit * 0.6); // 60% horizontal
        const verticalTarget = Math.ceil(limit * 0.4);   // 40% vertical
        const horizontalIllusts: typeof result.illustrations = [];
        const verticalIllusts: typeof result.illustrations = [];

        // Separate images by orientation, filtering out bad backgrounds
        // Don't stop early - collect as many as possible
        for (const illust of result.illustrations) {
            // Skip images with unsuitable tags
            if (await shouldSkipByTags(illust.tags, skipTags)) {
                continue;
            }

            if (!illust.width || !illust.height) {
                // Unknown dimensions - skip to ensure quality
                continue;
            }

            // Resolution check for high-quality wallpaper
            if (illust.width < MIN_WIDTH && illust.height < MIN_HEIGHT) {
                continue;
            }

            const ratio = illust.width / illust.height;

            if (ratio > 1.0) {
                // Horizontal (landscape)
                if (horizontalIllusts.length < horizontalTarget) {
                    horizontalIllusts.push(illust);
                }
            } else {
                // Vertical (portrait) or square
                if (verticalIllusts.length < verticalTarget) {
                    verticalIllusts.push(illust);
                }
            }

            // Stop only if we have enough of BOTH types
            if (horizontalIllusts.length >= horizontalTarget && verticalIllusts.length >= verticalTarget) {
                break;
            }
        }

        // If we didn't get enough of one type, fill with whatever is available
        // Prioritize horizontal since that's the user's preference
        if (horizontalIllusts.length < horizontalTarget) {
            // Try to fill remaining horizontal slots from remaining illustrations
            for (const illust of result.illustrations) {
                if (await shouldSkipByTags(illust.tags, skipTags)) continue;
                if (!illust.width || !illust.height) continue;
                const ratio = illust.width / illust.height;
                if (ratio > 1.0 && !horizontalIllusts.find(i => i.id === illust.id)) {
                    horizontalIllusts.push(illust);
                    if (horizontalIllusts.length >= horizontalTarget) break;
                }
            }
        }

        selectedIllusts = [...horizontalIllusts, ...verticalIllusts];
        await logInfo(
            `平衡筛选完成`,
            `横屏: ${horizontalIllusts.length}张, 竖屏: ${verticalIllusts.length}张 (目标比例 1.5:1)`
        );
    } else {
        // No balancing, just filter out bad backgrounds
        const filtered: typeof result.illustrations = [];
        for (const illust of result.illustrations) {
            if (!(await shouldSkipByTags(illust.tags, skipTags))) {
                filtered.push(illust);
                if (filtered.length >= limit) break;
            }
        }
        selectedIllusts = filtered;
    }

    return processBatch(selectedIllusts);
}

/**
 * Crawl and transfer images by tag
 * Also filters out images with no/simple backgrounds
 * Uses 1.5:1 horizontal:vertical ratio
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

    // Pre-load skip tags for efficiency
    const skipTags = await getSkipTags();

    // Filter out bad backgrounds and balance orientation
    let selectedIllusts: typeof result.illustrations = [];

    if (balanceOrientation) {
        // Target ratio: 1.5:1 (horizontal:vertical)
        const horizontalTarget = Math.ceil(limit * 0.6); // 60% horizontal
        const verticalTarget = Math.ceil(limit * 0.4);   // 40% vertical
        const horizontalIllusts: typeof result.illustrations = [];
        const verticalIllusts: typeof result.illustrations = [];

        for (const illust of result.illustrations) {
            if (await shouldSkipByTags(illust.tags, skipTags)) continue;
            if (!illust.width || !illust.height) continue;

            // Resolution check for high-quality wallpaper
            if (illust.width < MIN_WIDTH && illust.height < MIN_HEIGHT) {
                continue;
            }

            const ratio = illust.width / illust.height;

            if (ratio > 1.0 && horizontalIllusts.length < horizontalTarget) {
                horizontalIllusts.push(illust);
            } else if (ratio <= 1.0 && verticalIllusts.length < verticalTarget) {
                verticalIllusts.push(illust);
            }

            if (horizontalIllusts.length >= horizontalTarget && verticalIllusts.length >= verticalTarget) break;
        }

        selectedIllusts = [...horizontalIllusts, ...verticalIllusts];
    } else {
        const filtered: typeof result.illustrations = [];
        for (const illust of result.illustrations) {
            if (!(await shouldSkipByTags(illust.tags, skipTags))) {
                filtered.push(illust);
                if (filtered.length >= limit) break;
            }
        }
        selectedIllusts = filtered;
    }

    // Use 'tag' source to store in separate folder
    return processBatch(selectedIllusts, 'tag');
}

/**
 * Crawl and transfer related works for a PID
 * @param pid - Original Pixiv illustration ID
 * @param limit - Number of related works to fetch
 * @param source - 'ranking', 'tag' or 'pid' to determine storage folder
 */
export async function crawlRelated(
    pid: number,
    limit: number = BATCH_SIZE,
    source: ImageSource = 'pid'
): Promise<TransferResult> {
    // First process the original PID
    const originalResult = await processIllustration(pid, source);

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
    const batchResult = await processBatch(batch, source);

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
