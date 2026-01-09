/**
 * Manual Crawl API Route
 * Triggers immediate crawling from dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { crawlRanking, crawlByTag } from '@/lib/transfer';
import { isAuthenticated } from '@/lib/pixiv';
import {
    sendCrawlStartNotification,
    sendSimpleCrawlNotification,
    sendErrorAlert
} from '@/lib/webhook';

export const maxDuration = 300; // 增加超时时间以支持更多图片抓取

export async function POST(request: NextRequest) {
    if (!isAuthenticated()) {
        return NextResponse.json(
            { error: 'Pixiv authentication not configured' },
            { status: 500 }
        );
    }

    const startTime = Date.now();

    try {
        const body = await request.json();
        const { mode = 'ranking', tag, limit = 5 } = body;

        if (mode === 'tag' && tag) {
            // 标签搜索模式
            // 发送开始通知
            sendCrawlStartNotification('tag', { limit, tag }).catch(() => { });

            const result = await crawlByTag(tag, Math.min(limit, 20));

            // 发送完成通知
            const duration = (Date.now() - startTime) / 1000;
            sendSimpleCrawlNotification({
                type: 'tag',
                success: result.progress.success,
                failed: result.progress.failed,
                skipped: result.progress.skipped,
                duration,
                details: { tag }
            }).catch(() => { });

            return NextResponse.json({
                success: result.success,
                progress: result.progress,
                error: result.error,
            });
        } else {
            // 排行榜模式
            const supabase = createServerClient();
            const { data: settings } = await supabase
                .from('crawler_settings')
                .select('r18_enabled')
                .limit(1)
                .single();

            const isR18Enabled = settings && typeof settings === 'object' && 'r18_enabled' in settings
                ? (settings as { r18_enabled: boolean }).r18_enabled
                : false;

            // 发送开始通知
            sendCrawlStartNotification('manual', {
                limit,
                r18Enabled: isR18Enabled
            }).catch(() => { });

            // Always crawl normal ranking
            const halfLimit = Math.ceil(Math.min(limit, 50) / 2);
            const normalResult = await crawlRanking('daily', isR18Enabled ? halfLimit : Math.min(limit, 50));

            // Also crawl R18 if enabled
            let r18Result = null;
            if (isR18Enabled) {
                r18Result = await crawlRanking('daily_r18', halfLimit);
            }

            // Combine progress
            const combinedProgress = {
                total: normalResult.progress.total + (r18Result?.progress.total || 0),
                processed: normalResult.progress.processed + (r18Result?.progress.processed || 0),
                success: normalResult.progress.success + (r18Result?.progress.success || 0),
                failed: normalResult.progress.failed + (r18Result?.progress.failed || 0),
                skipped: normalResult.progress.skipped + (r18Result?.progress.skipped || 0),
            };

            // 发送完成通知
            const duration = (Date.now() - startTime) / 1000;
            sendSimpleCrawlNotification({
                type: 'manual',
                success: combinedProgress.success,
                failed: combinedProgress.failed,
                skipped: combinedProgress.skipped,
                duration,
            }).catch(() => { });

            return NextResponse.json({
                success: normalResult.success && (r18Result?.success ?? true),
                progress: combinedProgress,
                error: normalResult.error || r18Result?.error,
            });
        }
    } catch (error) {
        console.error('Manual crawl error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Crawl failed';

        // 发送错误通知
        sendErrorAlert(errorMessage, '手动抓取').catch(() => { });

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
