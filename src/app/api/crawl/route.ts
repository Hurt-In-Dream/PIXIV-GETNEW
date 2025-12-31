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
            const result = await crawlByTag(tag, Math.min(limit, 10));
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

            const isR18 = settings && typeof settings === 'object' && 'r18_enabled' in settings
                ? (settings as { r18_enabled: boolean }).r18_enabled
                : false;
            const rankingMode = isR18 ? 'daily_r18' : 'daily';
            const result = await crawlRanking(rankingMode, Math.min(limit, 10));

            return NextResponse.json({
                success: result.success,
                progress: result.progress,
                error: result.error,
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
