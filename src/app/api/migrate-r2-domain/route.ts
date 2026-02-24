/**
 * R2 域名迁移 API
 * 批量更新数据库中的 r2_url 域名
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { oldDomain, newDomain } = body;

        if (!oldDomain || !newDomain) {
            return NextResponse.json(
                { error: 'oldDomain and newDomain are required' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // 查找所有包含旧域名的记录
        const { data: images, error: fetchError } = await supabase
            .from('pixiv_images')
            .select('id, r2_url')
            .ilike('r2_url', `%${oldDomain}%`);

        if (fetchError) {
            return NextResponse.json(
                { error: fetchError.message },
                { status: 500 }
            );
        }

        if (!images || images.length === 0) {
            return NextResponse.json({
                success: true,
                message: '没有找到需要更新的记录',
                updated: 0,
            });
        }

        // 批量更新
        let updated = 0;
        let failed = 0;

        for (const image of images) {
            const newUrl = image.r2_url.replace(oldDomain, newDomain);

            const { error: updateError } = await supabase
                .from('pixiv_images')
                .update({ r2_url: newUrl })
                .eq('id', image.id);

            if (updateError) {
                failed++;
                console.error(`Failed to update ${image.id}:`, updateError);
            } else {
                updated++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `域名迁移完成: ${oldDomain} → ${newDomain}`,
            total: images.length,
            updated,
            failed,
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Migration failed' },
            { status: 500 }
        );
    }
}
