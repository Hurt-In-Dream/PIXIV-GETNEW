/**
 * Logs API Route
 * Fetch and manage crawler logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const level = searchParams.get('level') || 'all';

    try {
        const supabase = createServerClient();

        let query = supabase
            .from('crawler_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (level !== 'all') {
            query = query.eq('level', level);
        }

        const { data, error } = await query;

        if (error) {
            // Table might not exist yet
            if (error.code === '42P01') {
                return NextResponse.json({ logs: [] });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ logs: data || [] });
    } catch (error) {
        console.error('Logs API error:', error);
        return NextResponse.json({ logs: [] });
    }
}

export async function DELETE() {
    try {
        const supabase = createServerClient();

        const { error } = await supabase
            .from('crawler_logs')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete logs error:', error);
        return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
    }
}
