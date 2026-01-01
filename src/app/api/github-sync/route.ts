/**
 * GitHub Sync API Route
 * Converts R2 images to WebP and uploads to GitHub repository
 * Uses batch commit to avoid multiple deployments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import sharp from 'sharp';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'Hurt-In-Dream';
const GITHUB_REPO = 'EdgeOne_Function_PicAPI';
const GITHUB_BRANCH = 'main';

// Define sync categories
type SyncCategory = 'h' | 'v' | 'r18h' | 'r18v' | 'pidh' | 'pidv' | 'tagh' | 'tagv';

const SYNC_CONFIG: Record<SyncCategory, {
    githubDir: string;
    r2Pattern: string;
    r2Exclude?: string[];
    label: string;
}> = {
    h: {
        githubDir: 'ri/h',
        r2Pattern: '%/h/%',
        r2Exclude: ['%R18/%', '%tag/%', '%pid/%'],
        label: '排行榜横屏',
    },
    v: {
        githubDir: 'ri/v',
        r2Pattern: '%/v/%',
        r2Exclude: ['%R18/%', '%tag/%', '%pid/%'],
        label: '排行榜竖屏',
    },
    r18h: {
        githubDir: 'ri/r18/h',
        r2Pattern: '%R18/%/h/%',
        r2Exclude: [],
        label: 'R18横屏',
    },
    r18v: {
        githubDir: 'ri/r18/v',
        r2Pattern: '%R18/%/v/%',
        r2Exclude: [],
        label: 'R18竖屏',
    },
    pidh: {
        githubDir: 'ri/pid/h',
        r2Pattern: '%pid/h/%',
        r2Exclude: ['%R18/%'],
        label: 'PID横屏',
    },
    pidv: {
        githubDir: 'ri/pid/v',
        r2Pattern: '%pid/v/%',
        r2Exclude: ['%R18/%'],
        label: 'PID竖屏',
    },
    tagh: {
        githubDir: 'ri/tag/h',
        r2Pattern: '%tag/h/%',
        r2Exclude: ['%R18/%'],
        label: '标签横屏',
    },
    tagv: {
        githubDir: 'ri/tag/v',
        r2Pattern: '%tag/v/%',
        r2Exclude: ['%R18/%'],
        label: '标签竖屏',
    },
};

interface SyncResult {
    success: boolean;
    uploaded: number;
    errors: string[];
}

interface FileToUpload {
    path: string;
    content: string; // base64
    imageId: string;
    pid: number;
}

/**
 * Get the latest commit SHA for the branch
 */
async function getLatestCommitSha(): Promise<string | null> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.object.sha;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Get the tree SHA for a commit
 */
async function getTreeSha(commitSha: string): Promise<string | null> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${commitSha}`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.tree.sha;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Create a blob for a file
 */
async function createBlob(content: string): Promise<string | null> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content,
                    encoding: 'base64',
                }),
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Create a tree with multiple files
 */
async function createTree(
    baseTreeSha: string,
    files: { path: string; blobSha: string }[]
): Promise<string | null> {
    try {
        const tree = files.map(file => ({
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: file.blobSha,
        }));

        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    base_tree: baseTreeSha,
                    tree,
                }),
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Create a commit
 */
async function createCommit(
    message: string,
    treeSha: string,
    parentSha: string
): Promise<string | null> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    tree: treeSha,
                    parents: [parentSha],
                }),
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Update branch reference to new commit
 */
async function updateBranchRef(commitSha: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sha: commitSha,
                }),
            }
        );

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Batch upload files with single commit
 */
async function batchUploadToGitHub(
    files: FileToUpload[],
    commitMessage: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get latest commit SHA
        const latestCommitSha = await getLatestCommitSha();
        if (!latestCommitSha) {
            return { success: false, error: 'Failed to get latest commit' };
        }

        // Get tree SHA
        const treeSha = await getTreeSha(latestCommitSha);
        if (!treeSha) {
            return { success: false, error: 'Failed to get tree SHA' };
        }

        // Create blobs for all files
        const blobResults: { path: string; blobSha: string }[] = [];
        for (const file of files) {
            const blobSha = await createBlob(file.content);
            if (!blobSha) {
                console.error(`Failed to create blob for ${file.path}`);
                continue;
            }
            blobResults.push({ path: file.path, blobSha });
        }

        if (blobResults.length === 0) {
            return { success: false, error: 'Failed to create any blobs' };
        }

        // Create new tree
        const newTreeSha = await createTree(treeSha, blobResults);
        if (!newTreeSha) {
            return { success: false, error: 'Failed to create tree' };
        }

        // Create commit
        const newCommitSha = await createCommit(commitMessage, newTreeSha, latestCommitSha);
        if (!newCommitSha) {
            return { success: false, error: 'Failed to create commit' };
        }

        // Update branch reference
        const updated = await updateBranchRef(newCommitSha);
        if (!updated) {
            return { success: false, error: 'Failed to update branch' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

/**
 * Get existing file count in GitHub directory
 */
async function getExistingFileCount(dir: string): Promise<number> {
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
                let maxNum = 0;
                for (const file of files) {
                    const match = file.name.match(/^(\d+)\.webp$/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                }
                return maxNum;
            }
        }
        return 0;
    } catch {
        return 0;
    }
}

/**
 * Convert image to WebP format using sharp
 */
async function convertToWebP(imageBuffer: ArrayBuffer): Promise<Buffer> {
    const buffer = Buffer.from(imageBuffer);
    const webpBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
    return webpBuffer;
}

/**
 * Get images count for a category
 */
async function getCategoryCount(supabase: ReturnType<typeof createServerClient>, category: SyncCategory) {
    const config = SYNC_CONFIG[category];

    let query = supabase
        .from('pixiv_images')
        .select('*', { count: 'exact', head: true })
        .not('r2_url', 'is', null)
        .ilike('r2_url', config.r2Pattern);

    for (const exclude of config.r2Exclude || []) {
        query = query.not('r2_url', 'ilike', exclude);
    }

    const { count: total } = await query;

    let syncedQuery = supabase
        .from('pixiv_images')
        .select('*', { count: 'exact', head: true })
        .not('r2_url', 'is', null)
        .ilike('r2_url', config.r2Pattern)
        .not('github_synced', 'is', null);

    for (const exclude of config.r2Exclude || []) {
        syncedQuery = syncedQuery.not('r2_url', 'ilike', exclude);
    }

    const { count: synced } = await syncedQuery;

    return { total: total || 0, synced: synced || 0 };
}

/**
 * POST /api/github-sync - Sync images to GitHub with batch commit
 */
export async function POST(request: NextRequest) {
    if (!GITHUB_TOKEN) {
        return NextResponse.json(
            { error: 'GitHub Token 未配置' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { category = 'h', limit = 10 } = body as { category: SyncCategory; limit: number };

        const config = SYNC_CONFIG[category];
        if (!config) {
            return NextResponse.json(
                { error: 'Invalid category' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // Build query
        let query = supabase
            .from('pixiv_images')
            .select('*')
            .not('r2_url', 'is', null)
            .ilike('r2_url', config.r2Pattern)
            .is('github_synced', null)
            .order('created_at', { ascending: true })
            .limit(Math.min(limit, 50));

        for (const exclude of config.r2Exclude || []) {
            query = query.not('r2_url', 'ilike', exclude);
        }

        const { data: images, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!images || images.length === 0) {
            return NextResponse.json({
                success: true,
                message: `没有需要同步的${config.label}图片`,
                uploaded: 0,
            });
        }

        const result: SyncResult = {
            success: true,
            uploaded: 0,
            errors: [],
        };

        // Get starting number
        let currentNum = await getExistingFileCount(config.githubDir);

        // Prepare all files
        const filesToUpload: FileToUpload[] = [];
        const processedImages: { id: string; pid: number }[] = [];

        for (const image of images) {
            try {
                if (!image.r2_url) continue;

                const imageResponse = await fetch(image.r2_url);
                if (!imageResponse.ok) {
                    result.errors.push(`Failed to fetch: ${image.pid}`);
                    continue;
                }

                const imageBuffer = await imageResponse.arrayBuffer();
                const webpBuffer = await convertToWebP(imageBuffer);
                const base64Content = webpBuffer.toString('base64');

                currentNum++;
                const filename = `${currentNum}.webp`;
                const path = `${config.githubDir}/${filename}`;

                filesToUpload.push({
                    path,
                    content: base64Content,
                    imageId: image.id,
                    pid: image.pid,
                });

                processedImages.push({ id: image.id, pid: image.pid });
            } catch (err) {
                result.errors.push(`Error processing ${image.pid}: ${err}`);
            }
        }

        if (filesToUpload.length === 0) {
            return NextResponse.json({
                success: false,
                message: '没有成功处理任何图片',
                uploaded: 0,
                errors: result.errors,
            });
        }

        // Batch upload with single commit
        const commitMessage = `Add ${filesToUpload.length} ${config.label} images`;
        const uploadResult = await batchUploadToGitHub(filesToUpload, commitMessage);

        if (uploadResult.success) {
            // Mark all as synced
            for (const img of processedImages) {
                await supabase
                    .from('pixiv_images')
                    .update({ github_synced: new Date().toISOString() })
                    .eq('id', img.id);
            }
            result.uploaded = filesToUpload.length;
        } else {
            result.errors.push(uploadResult.error || 'Batch upload failed');
        }

        return NextResponse.json({
            success: result.errors.length === 0,
            uploaded: result.uploaded,
            total: images.length,
            errors: result.errors,
            category: config.label,
        });
    } catch (error) {
        console.error('GitHub sync error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Sync failed' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/github-sync - Get sync status for all categories
 */
export async function GET() {
    if (!GITHUB_TOKEN) {
        return NextResponse.json({ configured: false });
    }

    try {
        const supabase = createServerClient();

        const categories: Record<string, { total: number; synced: number; github: number }> = {};

        for (const [key, config] of Object.entries(SYNC_CONFIG)) {
            const counts = await getCategoryCount(supabase, key as SyncCategory);
            const github = await getExistingFileCount(config.githubDir);
            categories[key] = { ...counts, github };
        }

        return NextResponse.json({
            configured: true,
            categories,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get status' },
            { status: 500 }
        );
    }
}
