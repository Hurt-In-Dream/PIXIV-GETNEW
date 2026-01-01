/**
 * GitHub Sync API Route
 * Converts R2 images to WebP and uploads to GitHub repository
 * Also updates pic.js max values automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import sharp from 'sharp';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'Hurt-In-Dream';
const GITHUB_REPO = 'EdgeOne_Function_PicAPI';
const GITHUB_BRANCH = 'main';

interface SyncResult {
    success: boolean;
    uploaded: number;
    errors: string[];
}

/**
 * Get file content from GitHub
 */
async function getFileContent(path: string): Promise<{ content: string; sha: string } | null> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );

        if (response.ok) {
            const data = await response.json();
            // GitHub returns base64 encoded content
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return { content, sha: data.sha };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Get file SHA if it exists (needed for updating files)
 */
async function getFileSha(path: string): Promise<string | null> {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
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
 * Upload a file to GitHub
 */
async function uploadToGitHub(
    content: string, // base64 encoded
    path: string,
    message: string
): Promise<boolean> {
    try {
        // Check if file exists to get SHA
        const sha = await getFileSha(path);

        const body: Record<string, string> = {
            message,
            content,
            branch: GITHUB_BRANCH,
        };

        if (sha) {
            body.sha = sha;
        }

        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        return response.ok;
    } catch (error) {
        console.error('GitHub upload error:', error);
        return false;
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
                // Get highest number from existing files
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

    // Convert to WebP with good quality
    const webpBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();

    return webpBuffer;
}

/**
 * Update pic.js with new max values
 */
async function updatePicJsConfig(): Promise<{ success: boolean; message: string }> {
    try {
        // Get current file counts from GitHub
        const hCount = await getExistingFileCount('ri/h');
        const vCount = await getExistingFileCount('ri/v');
        const r18hCount = await getExistingFileCount('ri/r18/h');
        const r18vCount = await getExistingFileCount('ri/r18/v');
        const pidhCount = await getExistingFileCount('ri/pid/h');
        const pidvCount = await getExistingFileCount('ri/pid/v');

        // Get current pic.js content
        const fileData = await getFileContent('functions/pic.js');
        if (!fileData) {
            return { success: false, message: 'Failed to get pic.js content' };
        }

        let { content, sha } = fileData;

        // Update max values using regex
        content = content.replace(
            /h:\s*{\s*path:\s*'\/ri\/h\/'\s*,\s*max:\s*\d+\s*}/,
            `h: { path: '/ri/h/', max: ${hCount} }`
        );
        content = content.replace(
            /v:\s*{\s*path:\s*'\/ri\/v\/'\s*,\s*max:\s*\d+\s*}/,
            `v: { path: '/ri/v/', max: ${vCount} }`
        );
        content = content.replace(
            /r18h:\s*{\s*path:\s*'\/ri\/r18\/h\/'\s*,\s*max:\s*\d+\s*}/,
            `r18h: { path: '/ri/r18/h/', max: ${r18hCount || 1} }`
        );
        content = content.replace(
            /r18v:\s*{\s*path:\s*'\/ri\/r18\/v\/'\s*,\s*max:\s*\d+\s*}/,
            `r18v: { path: '/ri/r18/v/', max: ${r18vCount || 1} }`
        );
        content = content.replace(
            /pidh:\s*{\s*path:\s*'\/ri\/pid\/h\/'\s*,\s*max:\s*\d+\s*}/,
            `pidh: { path: '/ri/pid/h/', max: ${pidhCount || 1} }`
        );
        content = content.replace(
            /pidv:\s*{\s*path:\s*'\/ri\/pid\/v\/'\s*,\s*max:\s*\d+\s*}/,
            `pidv: { path: '/ri/pid/v/', max: ${pidvCount || 1} }`
        );

        // Upload updated file
        const base64Content = Buffer.from(content).toString('base64');

        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/functions/pic.js`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `Update image counts: h=${hCount}, v=${vCount}`,
                    content: base64Content,
                    sha: sha,
                    branch: GITHUB_BRANCH,
                }),
            }
        );

        if (response.ok) {
            return {
                success: true,
                message: `已更新 pic.js: h=${hCount}, v=${vCount}, r18h=${r18hCount}, r18v=${r18vCount}, pidh=${pidhCount}, pidv=${pidvCount}`
            };
        } else {
            const errorData = await response.json();
            return { success: false, message: `Failed to update pic.js: ${errorData.message}` };
        }
    } catch (error) {
        return { success: false, message: `Error updating pic.js: ${error}` };
    }
}

/**
 * POST /api/github-sync - Sync images to GitHub
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
        const { orientation = 'h', limit = 10, updateConfig = false } = body;

        // If only updating config
        if (updateConfig) {
            const configResult = await updatePicJsConfig();
            return NextResponse.json(configResult);
        }

        const supabase = createServerClient();

        // Get images from database that haven't been synced to GitHub
        // Only get ranking images (no R18, tag, pid prefix)
        const { data: images, error } = await supabase
            .from('pixiv_images')
            .select('*')
            .not('r2_url', 'is', null)
            .not('r2_url', 'ilike', '%R18/%')
            .not('r2_url', 'ilike', '%tag/%')
            .not('r2_url', 'ilike', '%pid/%')
            .ilike('r2_url', `%/${orientation}/%`)
            .is('github_synced', null) // Not yet synced
            .order('created_at', { ascending: true })
            .limit(Math.min(limit, 20));

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!images || images.length === 0) {
            return NextResponse.json({
                success: true,
                message: '没有需要同步的图片',
                uploaded: 0,
            });
        }

        const result: SyncResult = {
            success: true,
            uploaded: 0,
            errors: [],
        };

        // Get starting number for new files
        const dir = `ri/${orientation}`;
        let currentNum = await getExistingFileCount(dir);

        for (const image of images) {
            try {
                if (!image.r2_url) continue;

                // Fetch image from R2
                const imageResponse = await fetch(image.r2_url);
                if (!imageResponse.ok) {
                    result.errors.push(`Failed to fetch: ${image.pid}`);
                    continue;
                }

                // Get image as buffer
                const imageBuffer = await imageResponse.arrayBuffer();

                // Convert to WebP using sharp
                const webpBuffer = await convertToWebP(imageBuffer);

                // Convert to base64
                const base64Content = webpBuffer.toString('base64');

                // Increment number and create filename
                currentNum++;
                const filename = `${currentNum}.webp`;
                const path = `${dir}/${filename}`;

                // Upload to GitHub
                const uploaded = await uploadToGitHub(
                    base64Content,
                    path,
                    `Add ${filename} from PID ${image.pid}`
                );

                if (uploaded) {
                    // Mark as synced in database
                    await supabase
                        .from('pixiv_images')
                        .update({ github_synced: new Date().toISOString() })
                        .eq('id', image.id);

                    result.uploaded++;
                } else {
                    result.errors.push(`Failed to upload: ${image.pid}`);
                }

                // Rate limiting - GitHub API has limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
                result.errors.push(`Error processing ${image.pid}: ${err}`);
            }
        }

        // After uploading, update pic.js config
        let configUpdateMessage = '';
        if (result.uploaded > 0) {
            const configResult = await updatePicJsConfig();
            configUpdateMessage = configResult.message;
        }

        return NextResponse.json({
            success: result.errors.length === 0,
            uploaded: result.uploaded,
            total: images.length,
            errors: result.errors,
            configUpdate: configUpdateMessage,
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
 * GET /api/github-sync - Get sync status
 */
export async function GET() {
    if (!GITHUB_TOKEN) {
        return NextResponse.json({ configured: false });
    }

    try {
        const supabase = createServerClient();

        // Count synced vs unsynced images
        const { count: totalH } = await supabase
            .from('pixiv_images')
            .select('*', { count: 'exact', head: true })
            .not('r2_url', 'is', null)
            .not('r2_url', 'ilike', '%R18/%')
            .not('r2_url', 'ilike', '%tag/%')
            .not('r2_url', 'ilike', '%pid/%')
            .ilike('r2_url', '%/h/%');

        const { count: syncedH } = await supabase
            .from('pixiv_images')
            .select('*', { count: 'exact', head: true })
            .not('r2_url', 'is', null)
            .not('r2_url', 'ilike', '%R18/%')
            .not('r2_url', 'ilike', '%tag/%')
            .not('r2_url', 'ilike', '%pid/%')
            .ilike('r2_url', '%/h/%')
            .not('github_synced', 'is', null);

        const { count: totalV } = await supabase
            .from('pixiv_images')
            .select('*', { count: 'exact', head: true })
            .not('r2_url', 'is', null)
            .not('r2_url', 'ilike', '%R18/%')
            .not('r2_url', 'ilike', '%tag/%')
            .not('r2_url', 'ilike', '%pid/%')
            .ilike('r2_url', '%/v/%');

        const { count: syncedV } = await supabase
            .from('pixiv_images')
            .select('*', { count: 'exact', head: true })
            .not('r2_url', 'is', null)
            .not('r2_url', 'ilike', '%R18/%')
            .not('r2_url', 'ilike', '%tag/%')
            .not('r2_url', 'ilike', '%pid/%')
            .ilike('r2_url', '%/v/%')
            .not('github_synced', 'is', null);

        // Get current GitHub counts
        const githubH = await getExistingFileCount('ri/h');
        const githubV = await getExistingFileCount('ri/v');

        return NextResponse.json({
            configured: true,
            horizontal: { total: totalH || 0, synced: syncedH || 0, github: githubH },
            vertical: { total: totalV || 0, synced: syncedV || 0, github: githubV },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to get status' },
            { status: 500 }
        );
    }
}
