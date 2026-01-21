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
import { sendErrorAlert } from './webhook';

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

// Minimum resolution for "Wallpaper Quality" (1K/1080p)
// 横屏: 1920x1080, 竖屏: 1080x1920
// 短边至少 1080px
const MIN_SHORT_EDGE = 1080;
const MIN_LONG_EDGE = 1920;

// Skip square or near-square images (not suitable for wallpaper)
// Ratio between 0.85 and 1.18 is considered "square-ish"
const SQUARE_RATIO_MIN = 0.85;  // 1:1.18 (slightly portrait)
const SQUARE_RATIO_MAX = 1.18;  // 1.18:1 (slightly landscape)

// Popularity filtering for related works (PID crawling)
// 热度 = (点赞数 + 收藏数 × 2) / max(浏览量, 5000)
// Higher value = higher quality engagement
const MIN_POPULARITY_SCORE = 0.03;  // Minimum score to pass filter

/**
 * Calculate popularity score for an illustration
 * Formula: (likes + bookmarks * 2) / max(views, 5000)
 * Higher score = better engagement ratio
 */
export function calculatePopularity(
    likeCount: number = 0,
    bookmarkCount: number = 0,
    viewCount: number = 0
): number {
    const effectiveViews = Math.max(viewCount, 5000); // Avoid division issues
    return (likeCount + bookmarkCount * 2) / effectiveViews;
}

/**
 * Get popularity filter settings from database
 */
export async function getPopularityFilterSettings(): Promise<{
    auto: boolean;
    manual: boolean;
    pid: boolean;
}> {
    try {
        const supabase = createServerClient();
        const { data } = await supabase
            .from('crawler_settings')
            .select('popularity_filter_auto, popularity_filter_manual, popularity_filter_pid')
            .limit(1)
            .single();

        return {
            auto: data?.popularity_filter_auto ?? false,
            manual: data?.popularity_filter_manual ?? false,
            pid: data?.popularity_filter_pid ?? true,
        };
    } catch {
        // Default: only enable for PID
        return { auto: false, manual: false, pid: true };
    }
}

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
 * Continues fetching from more pages until target count is reached
 * Checks database duplicates during filtering to ensure NEW images
 */
export async function crawlRanking(
    mode: string = 'daily',
    limit: number = BATCH_SIZE,
    balanceOrientation: boolean = true
): Promise<TransferResult> {
    await logInfo(`开始抓取排行榜`, `模式: ${mode}, 目标新增: ${limit}张`);

    // Pre-load skip tags for efficiency
    const skipTags = await getSkipTags();

    // Target counts
    const horizontalTarget = balanceOrientation ? Math.ceil(limit * 0.6) : limit; // 60% horizontal
    const verticalTarget = balanceOrientation ? Math.ceil(limit * 0.4) : 0;   // 40% vertical

    const horizontalIllusts: PixivIllust[] = [];
    const verticalIllusts: PixivIllust[] = [];
    const seenPids = new Set<string>();

    let pageNum = 1;
    const maxPages = 10; // Prevent infinite loop
    let skippedByTag = 0;
    let skippedByResolution = 0;
    let skippedByDuplicate = 0;

    // Keep fetching until we have enough images or run out of pages
    while (pageNum <= maxPages) {
        const result = await getRanking(mode, pageNum);

        if (!result.success || result.illustrations.length === 0) {
            const errorMsg = result.error || '无内容';
            await logWarning(
                `排行榜获取失败或为空`,
                `模式: ${mode}, 页码: ${pageNum}, 错误: ${errorMsg}`
            );

            // 检测 PHPSESSID 过期并发送通知
            if (pageNum === 1) {
                const isAuthError = errorMsg.includes('PHPSESSID') ||
                    errorMsg.includes('expired') ||
                    errorMsg.includes('No contents');

                if (isAuthError) {
                    // 发送紧急通知
                    await sendErrorAlert(
                        '🔑 Pixiv PHPSESSID 已过期或无效！\n\n请尽快更新 PHPSESSID 环境变量，否则无法正常抓取图片。\n\n操作步骤：\n1. 登录 pixiv.net\n2. F12 打开开发者工具\n3. Application → Cookies → PHPSESSID\n4. 复制新值到 Vercel 环境变量',
                        '自动抓取失败'
                    );
                }

                return {
                    success: false,
                    progress: { total: 0, processed: 0, success: 0, failed: 0, skipped: 0 },
                    error: result.error || 'No illustrations found',
                };
            }
            break; // No more pages available
        }

        await logInfo(`获取到第${pageNum}页`, `共 ${result.illustrations.length} 张图片`);
        // Process each illustration
        for (const illust of result.illustrations) {
            // Skip duplicates within this crawl session
            if (seenPids.has(illust.id)) continue;
            seenPids.add(illust.id);

            // Skip images with unsuitable tags
            if (await shouldSkipByTags(illust.tags, skipTags)) {
                skippedByTag++;
                continue;
            }

            if (!illust.width || !illust.height) continue;

            // Resolution check for high-quality wallpaper (1080p minimum)
            // 短边至少 1080px
            const shortEdge = Math.min(illust.width, illust.height);
            if (shortEdge < MIN_SHORT_EDGE) {
                skippedByResolution++;
                continue;
            }

            // Check if already exists in database (NEW: filter duplicates early)
            const pid = parseInt(illust.id);
            if (await checkDuplicate(pid)) {
                skippedByDuplicate++;
                continue;
            }

            const ratio = illust.width / illust.height;

            // Skip square or near-square images (not suitable for wallpaper)
            if (ratio >= SQUARE_RATIO_MIN && ratio <= SQUARE_RATIO_MAX) {
                skippedByResolution++; // Count as resolution skip
                continue;
            }

            if (balanceOrientation) {
                if (ratio > SQUARE_RATIO_MAX && horizontalIllusts.length < horizontalTarget) {
                    horizontalIllusts.push(illust);
                } else if (ratio < SQUARE_RATIO_MIN && verticalIllusts.length < verticalTarget) {
                    verticalIllusts.push(illust);
                }
            } else {
                // No balancing needed
                if (horizontalIllusts.length < limit) {
                    horizontalIllusts.push(illust);
                }
            }

            // Check if we have enough
            if (balanceOrientation) {
                if (horizontalIllusts.length >= horizontalTarget && verticalIllusts.length >= verticalTarget) {
                    break;
                }
            } else {
                if (horizontalIllusts.length >= limit) break;
            }
        }

        // Check if we have enough images
        const hasEnough = balanceOrientation
            ? (horizontalIllusts.length >= horizontalTarget && verticalIllusts.length >= verticalTarget)
            : (horizontalIllusts.length >= limit);

        if (hasEnough) {
            break;
        }

        // Log progress and continue to next page
        await logInfo(
            `第${pageNum}页筛选完成，继续获取更多`,
            `当前: 横屏${horizontalIllusts.length}/${horizontalTarget}, 竖屏${verticalIllusts.length}/${verticalTarget}, 跳过(标签${skippedByTag}/分辨率${skippedByResolution}/重复${skippedByDuplicate})`
        );

        pageNum++;
        await delay(500); // Rate limiting between pages
    }

    const selectedIllusts = [...horizontalIllusts, ...verticalIllusts];

    await logInfo(
        `筛选完成 (共翻${pageNum}页)`,
        `将新增: 横屏${horizontalIllusts.length}张, 竖屏${verticalIllusts.length}张 | 跳过: 标签${skippedByTag}, 分辨率${skippedByResolution}, 已存在${skippedByDuplicate}`
    );

    return processBatch(selectedIllusts);
}

/**
 * Crawl and transfer images by tag
 * Also filters out images with no/simple backgrounds
 * Uses 1.5:1 horizontal:vertical ratio
 * Continues fetching from more pages until target count is reached
 * Checks database duplicates during filtering to ensure NEW images
 */
export async function crawlByTag(
    tag: string,
    limit: number = BATCH_SIZE,
    balanceOrientation: boolean = true
): Promise<TransferResult> {
    await logInfo(`开始按标签抓取`, `标签: ${tag}, 目标新增: ${limit}张`);

    // Pre-load skip tags for efficiency
    const skipTags = await getSkipTags();

    // Target counts
    const horizontalTarget = balanceOrientation ? Math.ceil(limit * 0.6) : limit;
    const verticalTarget = balanceOrientation ? Math.ceil(limit * 0.4) : 0;

    const horizontalIllusts: PixivIllust[] = [];
    const verticalIllusts: PixivIllust[] = [];
    const seenPids = new Set<string>();

    let pageNum = 1;
    const maxPages = 10;
    let skippedByTag = 0;
    let skippedByResolution = 0;
    let skippedByDuplicate = 0;

    // Keep fetching until we have enough images or run out of pages
    while (pageNum <= maxPages) {
        const result = await searchByTag(tag, pageNum);

        if (!result.success || result.illustrations.length === 0) {
            if (pageNum === 1) {
                return {
                    success: false,
                    progress: { total: 0, processed: 0, success: 0, failed: 0, skipped: 0 },
                    error: result.error || 'No illustrations found',
                };
            }
            break;
        }

        for (const illust of result.illustrations) {
            if (seenPids.has(illust.id)) continue;
            seenPids.add(illust.id);

            if (await shouldSkipByTags(illust.tags, skipTags)) {
                skippedByTag++;
                continue;
            }

            if (!illust.width || !illust.height) continue;

            // Resolution check (1080p minimum)
            const shortEdge = Math.min(illust.width, illust.height);
            if (shortEdge < MIN_SHORT_EDGE) {
                skippedByResolution++;
                continue;
            }

            // Check if already exists in database (NEW: filter duplicates early)
            const pid = parseInt(illust.id);
            if (await checkDuplicate(pid)) {
                skippedByDuplicate++;
                continue;
            }

            const ratio = illust.width / illust.height;

            // Skip square or near-square images (not suitable for wallpaper)
            if (ratio >= SQUARE_RATIO_MIN && ratio <= SQUARE_RATIO_MAX) {
                skippedByResolution++;
                continue;
            }

            if (balanceOrientation) {
                if (ratio > SQUARE_RATIO_MAX && horizontalIllusts.length < horizontalTarget) {
                    horizontalIllusts.push(illust);
                } else if (ratio < SQUARE_RATIO_MIN && verticalIllusts.length < verticalTarget) {
                    verticalIllusts.push(illust);
                }
            } else {
                if (horizontalIllusts.length < limit) {
                    horizontalIllusts.push(illust);
                }
            }

            const hasEnough = balanceOrientation
                ? (horizontalIllusts.length >= horizontalTarget && verticalIllusts.length >= verticalTarget)
                : (horizontalIllusts.length >= limit);

            if (hasEnough) break;
        }

        const hasEnough = balanceOrientation
            ? (horizontalIllusts.length >= horizontalTarget && verticalIllusts.length >= verticalTarget)
            : (horizontalIllusts.length >= limit);

        if (hasEnough) break;

        await logInfo(
            `[标签:${tag}] 第${pageNum}页筛选完成，继续获取更多`,
            `当前: 横屏${horizontalIllusts.length}/${horizontalTarget}, 竖屏${verticalIllusts.length}/${verticalTarget}, 跳过(标签${skippedByTag}/分辨率${skippedByResolution}/重复${skippedByDuplicate})`
        );

        pageNum++;
        await delay(500);
    }

    const selectedIllusts = [...horizontalIllusts, ...verticalIllusts];

    await logInfo(
        `[标签:${tag}] 筛选完成 (共翻${pageNum}页)`,
        `将新增: 横屏${horizontalIllusts.length}张, 竖屏${verticalIllusts.length}张 | 跳过: 标签${skippedByTag}, 分辨率${skippedByResolution}, 已存在${skippedByDuplicate}`
    );

    return processBatch(selectedIllusts, 'tag');
}

/**
 * Crawl and transfer related works for a PID
 * Uses two-pass filtering: first with popularity, then without if not enough results
 * @param pid - Original Pixiv illustration ID
 * @param limit - Number of related works to fetch
 * @param source - 'ranking', 'tag' or 'pid' to determine storage folder
 */
export async function crawlRelated(
    pid: number,
    limit: number = BATCH_SIZE,
    source: ImageSource = 'pid'
): Promise<TransferResult> {
    await logInfo(`开始抓取相关推荐`, `PID: ${pid}, 目标: ${limit}张`);

    // First process the original PID
    const originalResult = await processIllustration(pid, source);

    // Fetch a lot more to have room for filtering (max 100)
    const fetchLimit = Math.min(100, limit * 10);
    const result = await getRelatedWorks(pid, fetchLimit);

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

    // Pre-load skip tags
    const skipTags = await getSkipTags();

    // Get popularity filter settings
    const popularitySettings = await getPopularityFilterSettings();
    const usePopularityFilter = popularitySettings.pid;

    // Two-pass filtering: first with all filters, then relax popularity if not enough
    const filteredIllusts: PixivIllust[] = [];
    const backupIllusts: PixivIllust[] = []; // Images that passed everything except popularity
    let skippedByPopularity = 0;
    let skippedByTag = 0;
    let skippedByRatio = 0;
    let skippedByDuplicate = 0;

    for (const illust of result.illustrations) {
        // Skip by tags
        if (await shouldSkipByTags(illust.tags, skipTags)) {
            skippedByTag++;
            continue;
        }

        // Skip by ratio (square-ish images)
        if (illust.width && illust.height) {
            const ratio = illust.width / illust.height;
            if (ratio >= SQUARE_RATIO_MIN && ratio <= SQUARE_RATIO_MAX) {
                skippedByRatio++;
                continue;
            }
            // Also skip low resolution (1080p minimum)
            const shortEdge = Math.min(illust.width, illust.height);
            if (shortEdge < MIN_SHORT_EDGE) {
                skippedByRatio++;
                continue;
            }
        }

        // Check duplicate
        const illustPid = parseInt(illust.id);
        if (await checkDuplicate(illustPid)) {
            skippedByDuplicate++;
            continue;
        }

        // Calculate and check popularity score (only if enabled)
        if (usePopularityFilter) {
            const popularityScore = calculatePopularity(
                illust.likeCount,
                illust.bookmarkCount,
                illust.viewCount
            );

            if (popularityScore < MIN_POPULARITY_SCORE) {
                skippedByPopularity++;
                // Save to backup for potential use later
                backupIllusts.push(illust);
                continue;
            }
        }

        filteredIllusts.push(illust);

        // Stop if we have enough
        if (filteredIllusts.length >= limit) break;
    }

    // If not enough results, fill from backup (images that failed only popularity check)
    if (filteredIllusts.length < limit && backupIllusts.length > 0) {
        const needed = limit - filteredIllusts.length;
        const fromBackup = backupIllusts.slice(0, needed);
        filteredIllusts.push(...fromBackup);

        await logInfo(
            `热度筛选放宽`,
            `从备选中补充 ${fromBackup.length} 张 (原热度筛选跳过但其他条件通过的图片)`
        );
    }

    await logInfo(
        `相关推荐筛选完成`,
        `通过: ${filteredIllusts.length}张 | 跳过: 热度${skippedByPopularity}, 标签${skippedByTag}, 比例${skippedByRatio}, 重复${skippedByDuplicate}`
    );

    // If still no results, log warning
    if (filteredIllusts.length === 0) {
        await logWarning(
            `相关推荐筛选后无结果`,
            `PID ${pid} 的 ${result.illustrations.length} 张相关推荐全部被筛选掉。请检查筛选条件或尝试其他 PID。`
        );
    }

    const batchResult = await processBatch(filteredIllusts, source);

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


