/**
 * Cron API Route
 * Triggered by Vercel Cron for automated crawling
 * Uses Pixiv ranking.php directly:
 * - daily ranking for normal images
 * - daily_r18 ranking for R18 images (if enabled)
 * - tag search for specific content (if enabled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { crawlRanking, crawlByTag } from '@/lib/transfer';
import { isAuthenticated } from '@/lib/pixiv';

// Configure for longer execution time
export const maxDuration = 60; // 60 seconds for Pro/Enterprise plans

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    // Check Pixiv auth
    if (!isAuthenticated()) {
        return NextResponse.json(
            { error: 'Pixiv authentication not configured' },
            { status: 500 }
        );
    }

    try {
        // Get settings from database
        const supabase = createServerClient();
        const { data: settings } = await supabase
            .from('crawler_settings')
            .select('*')
            .limit(1)
            .single();

        const r18Enabled = settings?.r18_enabled || false;
        const crawlLimit = settings?.crawl_limit || 10;
        const r18CrawlLimit = settings?.r18_crawl_limit || 10;
        const tagSearchEnabled = settings?.tag_search_enabled || false;
        const tagSearchLimit = settings?.tag_search_limit || 10;
        const tags = settings?.tags || ['風景'];

        // 1. Crawl from daily ranking (https://www.pixiv.net/ranking.php?mode=daily)
        const normalResult = await crawlRanking('daily', crawlLimit, true);

        // 2. Crawl R18 ranking if enabled (https://www.pixiv.net/ranking.php?mode=daily_r18)
        let r18Result = null;
        if (r18Enabled) {
            r18Result = await crawlRanking('daily_r18', r18CrawlLimit, true);
        }

        // 3. Crawl by tag if enabled (stored in separate tag/ folder)
        let tagResult = null;
        if (tagSearchEnabled && tags.length > 0) {
            const randomTag = tags[Math.floor(Math.random() * tags.length)];
            tagResult = await crawlByTag(randomTag, tagSearchLimit);
        }

        return NextResponse.json({
            success: true,
            ranking: {
                mode: 'daily',
                ...normalResult.progress,
            },
            r18Ranking: r18Enabled ? {
                mode: 'daily_r18',
                ...r18Result?.progress,
            } : null,
            tagSearch: tagSearchEnabled ? {
                enabled: true,
                ...tagResult?.progress,
            } : null,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Cron job failed' },
            { status: 500 }
        );
    }
}
