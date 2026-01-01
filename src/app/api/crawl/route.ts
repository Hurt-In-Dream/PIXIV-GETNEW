/**
 * Manual Crawl API Route
 * Triggers immediate crawling from dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { crawlRanking, crawlByTag } from '@/lib/transfer';
import { isAuthenticated } from '@/lib/pixiv';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    if (!isAuthenticated()) {
        return NextResponse.json(
            { error: 'Pixiv authentication not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { mode = 'ranking', tag, limit = 5 } = body;

        if (mode === 'tag' && tag) {
            const result = await crawlByTag(tag, Math.min(limit, 20));
            return NextResponse.json({
                success: result.success,
                progress: result.progress,
                error: result.error,
            });
        } else {
            // Get settings for ranking mode
            const supabase = createServerClient();
            const { data: settings } = await supabase
                .from('crawler_settings')
                .select('r18_enabled')
                .limit(1)
                .single();

            const isR18Enabled = settings && typeof settings === 'object' && 'r18_enabled' in settings
                ? (settings as { r18_enabled: boolean }).r18_enabled
                : false;

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

            return NextResponse.json({
                success: normalResult.success && (r18Result?.success ?? true),
                progress: combinedProgress,
                error: normalResult.error || r18Result?.error,
            });
        }
    } catch (error) {
        console.error('Manual crawl error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Crawl failed' },
            { status: 500 }
        );
    }
}
