/**
 * Favorite Tags API Route
 * Manage user's favorite tags for smart crawling
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createServerClient();

        const { data, error } = await supabase
            .from('favorite_tags')
            .select('*')
            .order('weight', { ascending: false });

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ tags: data || [] });
    } catch (error) {
        console.error('Favorite tags GET error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tag, tag_jp } = body;

        if (!tag) {
            return NextResponse.json(
                { error: 'Tag is required' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Check if tag already exists
        const { data: existing } = await supabase
            .from('favorite_tags')
            .select('id, weight')
            .eq('tag', tag)
            .single();

        if (existing) {
            // Increment weight
            const { error } = await supabase
                .from('favorite_tags')
                .update({
                    weight: existing.weight + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'incremented',
                newWeight: existing.weight + 1
            });
        } else {
            // Insert new tag
            const { error } = await supabase
                .from('favorite_tags')
                .insert({
                    tag,
                    tag_jp: tag_jp || tag,
                    weight: 1,
                });

            if (error) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'created',
                newWeight: 1
            });
        }
    } catch (error) {
        console.error('Favorite tags POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to add' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, tag } = body;

        const supabase = createServerClient();

        let query = supabase.from('favorite_tags').delete();

        if (id) {
            query = query.eq('id', id);
        } else if (tag) {
            query = query.eq('tag', tag);
        } else {
            return NextResponse.json(
                { error: 'ID or tag is required' },
                { status: 400 }
            );
        }

        const { error } = await query;

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Favorite tags DELETE error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete' },
            { status: 500 }
        );
    }
}
