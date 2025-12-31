/**
 * Settings API Route
 * CRUD for crawler settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createServerClient();

        const { data, error } = await supabase
            .from('crawler_settings')
            .select('*')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        // Return default settings if none exist
        const settings = data || {
            cron_expression: '0 0 * * *',
            tags: ['イラスト', '二次元', '風景'],
            r18_enabled: false,
        };

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cron_expression, tags, r18_enabled } = body;

        const supabase = createServerClient();

        // Check if settings exist
        const { data: existing } = await supabase
            .from('crawler_settings')
            .select('id')
            .limit(1)
            .single();

        if (existing) {
            // Update existing
            const { error } = await supabase
                .from('crawler_settings')
                .update({
                    cron_expression: cron_expression || '0 0 * * *',
                    tags: tags || ['イラスト'],
                    r18_enabled: r18_enabled ?? false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            if (error) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 }
                );
            }
        } else {
            // Insert new
            const { error } = await supabase
                .from('crawler_settings')
                .insert({
                    cron_expression: cron_expression || '0 0 * * *',
                    tags: tags || ['イラスト'],
                    r18_enabled: r18_enabled ?? false,
                });

            if (error) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save settings' },
            { status: 500 }
        );
    }
}
