/**
 * Cron API Route
 * Triggered by Vercel Cron for automated crawling
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

        const tags = settings?.tags || ['イラスト'];
        const r18Enabled = settings?.r18_enabled || false;
        const crawlLimit = settings?.crawl_limit || 10;
        const r18CrawlLimit = settings?.r18_crawl_limit || 10;

        // Crawl normal ranking (always)
        const normalResult = await crawlRanking('daily', crawlLimit, true);

        // Crawl R18 ranking if enabled (in addition to normal)
        let r18Result = null;
        if (r18Enabled) {
            r18Result = await crawlRanking('daily_r18', r18CrawlLimit, true);
        }

        // Then crawl by tags (one random tag)
        const randomTag = tags[Math.floor(Math.random() * tags.length)];
        const tagResult = await crawlByTag(randomTag, crawlLimit);

        return NextResponse.json({
            success: true,
            ranking: normalResult.progress,
            r18Ranking: r18Result?.progress || null,
            tag: {
                tag: randomTag,
                ...tagResult.progress,
            },
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
