/**
 * PID Fetch API Route
 * Fetches a specific PID and its related works
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlRelated, processIllustration } from '@/lib/transfer';
import { isAuthenticated } from '@/lib/pixiv';
import {
    sendCrawlStartNotification,
    sendSimpleCrawlNotification,
    sendErrorAlert
} from '@/lib/webhook';

export const maxDuration = 300; // 增加超时时间以支持抓取相关推荐

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
        const { pid, fetchRelated = true, limit = 5 } = body;

        if (!pid || isNaN(Number(pid))) {
            return NextResponse.json(
                { error: 'Invalid PID provided' },
                { status: 400 }
            );
        }

        const numPid = Number(pid);

        // 发送开始通知
        sendCrawlStartNotification('pid', {
            pid: numPid,
            limit: fetchRelated ? limit : 1
        }).catch(() => { });

        if (fetchRelated) {
            // Fetch the PID and its related works
            const result = await crawlRelated(numPid, Math.min(limit, 10));

            // 发送完成通知
            const duration = (Date.now() - startTime) / 1000;
            sendSimpleCrawlNotification({
                type: 'pid',
                success: result.progress.success,
                failed: result.progress.failed,
                skipped: result.progress.skipped,
                duration,
                details: { pid: numPid }
            }).catch(() => { });

            return NextResponse.json({
                success: result.success,
                progress: result.progress,
                error: result.error,
            });
        } else {
            // Just fetch the single PID
            const result = await processIllustration(numPid, 'pid');

            // 发送完成通知
            const duration = (Date.now() - startTime) / 1000;
            sendSimpleCrawlNotification({
                type: 'pid',
                success: result.success && !result.skipped ? 1 : 0,
                failed: result.success ? 0 : 1,
                skipped: result.skipped ? 1 : 0,
                duration,
                details: { pid: numPid }
            }).catch(() => { });

            return NextResponse.json({
                success: result.success,
                skipped: result.skipped,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('PID fetch error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Fetch failed';

        // 发送错误通知
        sendErrorAlert(errorMessage, 'PID 抓取').catch(() => { });

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
