/**
 * Skip Tags API Route
 * Manage filter tags for image crawling
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

interface SkipTag {
    id: string;
    tag: string;
    translation: string | null;
    category: string;
    created_at: string;
}

export async function GET() {
    try {
        const supabase = createServerClient();

        const { data, error } = await supabase
            .from('skip_tags')
            .select('*')
            .order('category', { ascending: true })
            .order('tag', { ascending: true });

        if (error) {
            // Table might not exist
            if (error.code === '42P01') {
                return NextResponse.json({ tags: [] });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ tags: data || [] });
    } catch (error) {
        console.error('Skip tags API error:', error);
        return NextResponse.json({ tags: [] });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tag, translation, category = 'other' } = body;

        if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
            return NextResponse.json(
                { error: '标签不能为空' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        const { data, error } = await supabase
            .from('skip_tags')
            .insert({
                tag: tag.trim(),
                translation: translation?.trim() || null,
                category: category || 'other',
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: '该标签已存在' },
                    { status: 400 }
                );
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, tag: data });
    } catch (error) {
        console.error('Add skip tag error:', error);
        return NextResponse.json(
            { error: 'Failed to add tag' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Tag ID required' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        const { error } = await supabase
            .from('skip_tags')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete skip tag error:', error);
        return NextResponse.json(
            { error: 'Failed to delete tag' },
            { status: 500 }
        );
    }
}
