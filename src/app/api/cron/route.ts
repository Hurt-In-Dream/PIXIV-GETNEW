/**
 * Cron API Route
 * Automated scheduled crawling with smart tag priority
 * Features:
 * - Daily ranking crawl
 * - R18 ranking crawl (if enabled)
 * - Tag search (if enabled)
 * - Smart crawl based on favorite tags (weighted selection)
 * - WeChat Work webhook notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { crawlRanking, crawlByTag } from '@/lib/transfer';
import { isAuthenticated } from '@/lib/pixiv';
import { logActivity } from '@/lib/logger';
import { sendCrawlNotification, sendErrorAlert, sendCrawlStartNotification, type CrawlReport } from '@/lib/webhook';

export const maxDuration = 300; // Vercel Cron Jobs 最大支持 300 秒

interface FavoriteTag {
    tag: string;
    tag_jp: string;
    weight: number;
}

/**
 * Select tags based on weight (weighted random selection)
 */
function selectWeightedTags(tags: FavoriteTag[], count: number): FavoriteTag[] {
    if (tags.length === 0) return [];
    if (tags.length <= count) return tags;

    const selected: FavoriteTag[] = [];
    const remaining = [...tags];

    while (selected.length < count && remaining.length > 0) {
        // Calculate total weight of remaining tags
        const totalWeight = remaining.reduce((sum, t) => sum + t.weight, 0);

        // Weighted random selection
        let randomWeight = Math.random() * totalWeight;
        let selectedIndex = 0;

        for (let i = 0; i < remaining.length; i++) {
            randomWeight -= remaining[i].weight;
            if (randomWeight <= 0) {
                selectedIndex = i;
                break;
            }
        }

        selected.push(remaining[selectedIndex]);
        remaining.splice(selectedIndex, 1);
    }

    return selected;
}

export async function GET(request: NextRequest) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAuthenticated()) {
        return NextResponse.json(
            { error: 'Pixiv authentication not configured' },
            { status: 500 }
        );
    }

    try {
        const startTime = Date.now();
        const usedTags: string[] = []; // 记录本次使用的标签

        const supabase = createServerClient();
        await logActivity('info', '[自动抓取] 开始执行定时任务...');

        // 发送开始通知（先获取设置后发送更详细的通知）

        // Get settings
        const { data: settings } = await supabase
            .from('crawler_settings')
            .select('*')
            .limit(1)
            .single();

        const crawlLimit = settings?.crawl_limit || 10;
        const r18Enabled = settings?.r18_enabled || false;
        const r18CrawlLimit = settings?.r18_crawl_limit || 10;
        const tagSearchEnabled = settings?.tag_search_enabled || false;
        const tagSearchLimit = settings?.tag_search_limit || 10;
        const configTags = settings?.tags || [];

        const results = {
            ranking: { success: 0, failed: 0, skipped: 0 },
            r18: { success: 0, failed: 0, skipped: 0 },
            tag: { success: 0, failed: 0, skipped: 0 },
            favorite: { success: 0, failed: 0, skipped: 0 },
        };

        // 发送开始通知
        sendCrawlStartNotification('auto', {
            limit: crawlLimit + (r18Enabled ? r18CrawlLimit : 0),
            r18Enabled,
        }).catch(() => { });

        // 1. Crawl normal ranking
        await logActivity('info', `[自动抓取] 抓取普通排行榜 (${crawlLimit}张)...`);
        const normalResult = await crawlRanking('daily', crawlLimit, true);
        results.ranking = {
            success: normalResult.progress.success,
            failed: normalResult.progress.failed,
            skipped: normalResult.progress.skipped,
        };

        // 2. Crawl R18 if enabled
        if (r18Enabled) {
            await logActivity('info', `[自动抓取] 抓取R18排行榜 (${r18CrawlLimit}张)...`);
            const r18Result = await crawlRanking('daily_r18', r18CrawlLimit, true);
            results.r18 = {
                success: r18Result.progress.success,
                failed: r18Result.progress.failed,
                skipped: r18Result.progress.skipped,
            };
        }

        // 3. Crawl by configured tags if enabled
        if (tagSearchEnabled && configTags.length > 0) {
            const randomTag = configTags[Math.floor(Math.random() * configTags.length)];
            usedTags.push(randomTag); // 记录使用的标签
            await logActivity('info', `[自动抓取] 标签搜索 "${randomTag}" (${tagSearchLimit}张)...`);
            const tagResult = await crawlByTag(randomTag, tagSearchLimit);
            results.tag = {
                success: tagResult.progress.success,
                failed: tagResult.progress.failed,
                skipped: tagResult.progress.skipped,
            };
        }

        // 4. Smart crawl based on favorite tags (NEW FEATURE!)
        const { data: favoriteTags } = await supabase
            .from('favorite_tags')
            .select('tag, tag_jp, weight')
            .order('weight', { ascending: false });

        if (favoriteTags && favoriteTags.length > 0) {
            // Select up to 2 tags based on weight
            const selectedTags = selectWeightedTags(favoriteTags as FavoriteTag[], 2);

            for (const favTag of selectedTags) {
                const tagToSearch = favTag.tag_jp || favTag.tag;
                // Crawl more images for higher weight tags (min 3, max 8)
                const limitForTag = Math.min(8, Math.max(3, Math.ceil(favTag.weight)));

                usedTags.push(tagToSearch); // 记录使用的标签
                await logActivity('info', `[智能抓取] 根据喜欢标签 "${tagToSearch}" (权重:${favTag.weight}) 抓取${limitForTag}张...`);

                try {
                    const favResult = await crawlByTag(tagToSearch, limitForTag);
                    results.favorite.success += favResult.progress.success;
                    results.favorite.failed += favResult.progress.failed;
                    results.favorite.skipped += favResult.progress.skipped;
                } catch (error) {
                    await logActivity('warning', `[智能抓取] 标签 "${tagToSearch}" 抓取失败`);
                }
            }
        }

        // Summary log
        const totalSuccess = results.ranking.success + results.r18.success + results.tag.success + results.favorite.success;
        const totalFailed = results.ranking.failed + results.r18.failed + results.tag.failed + results.favorite.failed;
        const totalSkipped = results.ranking.skipped + results.r18.skipped + results.tag.skipped + results.favorite.skipped;

        await logActivity('success',
            `[自动抓取] 完成! 成功:${totalSuccess} 失败:${totalFailed} 跳过:${totalSkipped} ` +
            `(排行:${results.ranking.success} R18:${results.r18.success} 标签:${results.tag.success} 智能:${results.favorite.success})`
        );

        // 发送企业微信 Webhook 通知
        const duration = (Date.now() - startTime) / 1000; // 秒
        const crawlReport: CrawlReport = {
            stats: results,
            totalSuccess,
            totalFailed,
            totalSkipped,
            duration,
            tags: usedTags.length > 0 ? usedTags : undefined,
            r18Enabled,
            tagSearchEnabled,
            timestamp: new Date(),
        };

        // 异步发送通知，不阻塞响应
        sendCrawlNotification(crawlReport).catch((err) => {
            console.error('Webhook notification failed:', err);
        });

        return NextResponse.json({
            success: true,
            results,
            summary: {
                total: totalSuccess + totalFailed + totalSkipped,
                success: totalSuccess,
                failed: totalFailed,
                skipped: totalSkipped,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logActivity('error', `[自动抓取] 失败: ${errorMessage}`);

        // 发送错误报警
        sendErrorAlert(errorMessage, '定时自动抓取').catch((err) => {
            console.error('Webhook error alert failed:', err);
        });

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
