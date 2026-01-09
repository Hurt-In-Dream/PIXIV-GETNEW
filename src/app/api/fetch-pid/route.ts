/**
 * PID Fetch API Route
 * Fetches a specific PID and its related works
 */

import { NextRequest, NextResponse } from 'next/server';
import { crawlRelated, processIllustration } from '@/lib/transfer';
import { isAuthenticated } from '@/lib/pixiv';

export const maxDuration = 300; // 增加超时时间以支持抓取相关推荐

export async function POST(request: NextRequest) {
    if (!isAuthenticated()) {
        return NextResponse.json(
            { error: 'Pixiv authentication not configured' },
            { status: 500 }
        );
    }

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

        if (fetchRelated) {
            // Fetch the PID and its related works
            const result = await crawlRelated(numPid, Math.min(limit, 10));
            return NextResponse.json({
                success: result.success,
                progress: result.progress,
                error: result.error,
            });
        } else {
            // Just fetch the single PID
            const result = await processIllustration(numPid, 'pid');
            return NextResponse.json({
                success: result.success,
                skipped: result.skipped,
                error: result.error,
            });
        }
    } catch (error) {
        console.error('PID fetch error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Fetch failed' },
            { status: 500 }
        );
    }
}
