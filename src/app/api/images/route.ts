/**
 * Images API Route
 * List and manage stored images with source filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || 'ranking'; // ranking, r18, tag, pid, all

    const offset = (page - 1) * limit;

    try {
        const supabase = createServerClient();

        let query = supabase
            .from('pixiv_images')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Filter by source based on r2_url path
        switch (source) {
            case 'ranking':
                // Normal ranking: no prefix (h/ or v/ directly)
                query = query
                    .not('r2_url', 'ilike', '%R18/%')
                    .not('r2_url', 'ilike', '%tag/%')
                    .not('r2_url', 'ilike', '%pid/%');
                break;
            case 'r18':
                // R18 content
                query = query.ilike('r2_url', '%R18/%');
                break;
            case 'tag':
                // Tag search results
                query = query
                    .ilike('r2_url', '%tag/%')
                    .not('r2_url', 'ilike', '%R18/%');
                break;
            case 'pid':
                // PID fetch results
                query = query
                    .ilike('r2_url', '%pid/%')
                    .not('r2_url', 'ilike', '%R18/%');
                break;
            case 'all':
                // Show all images (no filter)
                break;
            default:
                // Default: exclude R18
                query = query.not('r2_url', 'ilike', '%R18/%');
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        if (search) {
            query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%`);
        }

        const { data, count, error } = await query;

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            images: data || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        });
    } catch (error) {
        console.error('Images API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch images' },
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
                { error: 'Image ID required' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // First get the image to get the R2 URL
        const { data: image } = await supabase
            .from('pixiv_images')
            .select('r2_url')
            .eq('id', id)
            .single();

        // Try to delete from R2 if URL exists
        if (image?.r2_url) {
            try {
                // Extract the key from R2 URL
                const r2Url = new URL(image.r2_url);
                const key = r2Url.pathname.slice(1); // Remove leading /

                // Delete from R2 using S3 API
                const r2Endpoint = process.env.R2_ENDPOINT;
                const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
                const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
                const r2Bucket = process.env.R2_BUCKET_NAME;

                if (r2Endpoint && r2AccessKey && r2SecretKey && r2Bucket) {
                    // Import S3 client dynamically
                    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

                    const s3Client = new S3Client({
                        region: 'auto',
                        endpoint: r2Endpoint,
                        credentials: {
                            accessKeyId: r2AccessKey,
                            secretAccessKey: r2SecretKey,
                        },
                    });

                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: r2Bucket,
                        Key: key,
                    }));

                    console.log(`Deleted from R2: ${key}`);
                }
            } catch (r2Error) {
                // Log but don't fail the whole operation
                console.error('Failed to delete from R2:', r2Error);
            }
        }

        // Delete from database
        const { error } = await supabase
            .from('pixiv_images')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, r2Deleted: !!image?.r2_url });
    } catch (error) {
        console.error('Delete image error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete image' },
            { status: 500 }
        );
    }
}
