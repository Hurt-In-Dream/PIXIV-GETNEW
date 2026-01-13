/**
 * GitHub Sync Fix API
 * 修复数据库中的 github_synced 状态与实际 GitHub 仓库不一致的问题
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'Hurt-In-Dream';
const GITHUB_REPO = 'EdgeOne_Function_PicAPI';
const GITHUB_BRANCH = 'main';

type SyncCategory = 'h' | 'v' | 'r18h' | 'r18v' | 'pidh' | 'pidv' | 'tagh' | 'tagv';

const SYNC_CONFIG: Record<SyncCategory, {
    githubDir: string;
    r2Pattern: string;
    r2Exclude?: string[];
    label: string;
}> = {
    h: { githubDir: 'ri/h', r2Pattern: '%/h/%', r2Exclude: ['%R18/%', '%tag/%', '%pid/%'], label: '排行榜横屏' },
    v: { githubDir: 'ri/v', r2Pattern: '%/v/%', r2Exclude: ['%R18/%', '%tag/%', '%pid/%'], label: '排行榜竖屏' },
    r18h: { githubDir: 'ri/r18/h', r2Pattern: '%R18/h/%', r2Exclude: [], label: 'R18横屏' },
    r18v: { githubDir: 'ri/r18/v', r2Pattern: '%R18/v/%', r2Exclude: [], label: 'R18竖屏' },
    pidh: { githubDir: 'ri/pid/h', r2Pattern: '%pid/h/%', r2Exclude: ['%R18/%'], label: 'PID横屏' },
    pidv: { githubDir: 'ri/pid/v', r2Pattern: '%pid/v/%', r2Exclude: ['%R18/%'], label: 'PID竖屏' },
    tagh: { githubDir: 'ri/tag/h', r2Pattern: '%tag/h/%', r2Exclude: ['%R18/%'], label: '标签横屏' },
    tagv: { githubDir: 'ri/tag/v', r2Pattern: '%tag/v/%', r2Exclude: ['%R18/%'], label: '标签竖屏' },
};

/**
 * 获取 GitHub 目录中的文件数量
 */
async function getGitHubFileCount(dir: string): Promise<number> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${dir}?ref=${GITHUB_BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );

        if (response.ok) {
            const files = await response.json();
            if (Array.isArray(files)) {
                return files.filter(f => f.name.endsWith('.webp')).length;
            }
        }
        return 0;
    } catch {
        return 0;
    }
}

/**
 * POST /api/github-sync-fix - 修复同步状态
 */
export async function POST(request: NextRequest) {
    if (!GITHUB_TOKEN) {
        return NextResponse.json(
            { error: 'GitHub Token 未配置' },
            { status: 500 }
        );
    }

    try {
        const supabase = createServerClient();
        const results: Record<string, { fixed: number; errors: number }> = {};

        for (const [category, config] of Object.entries(SYNC_CONFIG)) {
            const githubCount = await getGitHubFileCount(config.githubDir);

            if (githubCount === 0) {
                results[category] = { fixed: 0, errors: 0 };
                continue;
            }

            // 获取该分类下所有图片
            let query = supabase
                .from('pixiv_images')
                .select('id, pid, r2_url')
                .not('r2_url', 'is', null)
                .ilike('r2_url', config.r2Pattern)
                .limit(githubCount);

            for (const exclude of config.r2Exclude || []) {
                query = query.not('r2_url', 'ilike', exclude);
            }

            const { data: images, error } = await query;

            if (error || !images) {
                results[category] = { fixed: 0, errors: 1 };
                continue;
            }

            // 标记前 N 张为已同步（N = GitHub 文件数量）
            let fixed = 0;
            let errors = 0;

            for (let i = 0; i < Math.min(images.length, githubCount); i++) {
                const { error: updateError } = await supabase
                    .from('pixiv_images')
                    .update({ github_synced: new Date().toISOString() })
                    .eq('id', images[i].id);

                if (updateError) {
                    errors++;
                } else {
                    fixed++;
                }
            }

            results[category] = { fixed, errors };
        }

        return NextResponse.json({
            success: true,
            message: '同步状态修复完成',
            results,
        });
    } catch (error) {
        console.error('Sync fix error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Fix failed' },
            { status: 500 }
        );
    }
}
