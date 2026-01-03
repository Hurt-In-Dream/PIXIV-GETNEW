/**
 * Cleanup API Route
 * Tools for cleaning up orphaned files in R2 and GitHub
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'Hurt-In-Dream';
const GITHUB_REPO = 'EdgeOne_Function_PicAPI';
const GITHUB_BRANCH = 'main';

// Initialize S3 client for R2
function getS3Client() {
    const r2Endpoint = process.env.R2_ENDPOINT;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!r2Endpoint || !r2AccessKey || !r2SecretKey) {
        return null;
    }

    return new S3Client({
        region: 'auto',
        endpoint: r2Endpoint,
        credentials: {
            accessKeyId: r2AccessKey,
            secretAccessKey: r2SecretKey,
        },
    });
}

/**
 * GET - Analyze orphaned files
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target'); // 'r2' or 'github'

    try {
        if (target === 'r2') {
            return await analyzeR2Orphans();
        } else if (target === 'github') {
            return await analyzeGitHubFiles();
        } else {
            return NextResponse.json({
                usage: {
                    analyzeR2: 'GET /api/cleanup?target=r2',
                    analyzeGitHub: 'GET /api/cleanup?target=github',
                    cleanR2: 'POST /api/cleanup { "action": "clean-r2", "dryRun": true }',
                    cleanGitHub: 'POST /api/cleanup { "action": "clean-github", "category": "h", "dryRun": true }',
                }
            });
        }
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed' },
            { status: 500 }
        );
    }
}

/**
 * Analyze R2 for orphaned files
 */
async function analyzeR2Orphans() {
    const s3Client = getS3Client();
    const bucket = process.env.R2_BUCKET_NAME;

    if (!s3Client || !bucket) {
        return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
    }

    const supabase = createServerClient();

    // Get all R2 URLs from database
    const { data: dbImages } = await supabase
        .from('pixiv_images')
        .select('r2_url')
        .not('r2_url', 'is', null);

    const dbUrls = new Set(dbImages?.map(img => img.r2_url) || []);

    // List all files in R2
    const r2Files: string[] = [];
    let continuationToken: string | undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
        });

        const response = await s3Client.send(command);

        for (const obj of response.Contents || []) {
            if (obj.Key) {
                r2Files.push(obj.Key);
            }
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Find orphaned files (in R2 but not in database)
    const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
    const orphanedFiles: string[] = [];

    for (const key of r2Files) {
        const fullUrl = `${r2PublicUrl}/${key}`;
        if (!dbUrls.has(fullUrl)) {
            orphanedFiles.push(key);
        }
    }

    return NextResponse.json({
        totalR2Files: r2Files.length,
        totalDbRecords: dbUrls.size,
        orphanedCount: orphanedFiles.length,
        orphanedFiles: orphanedFiles.slice(0, 50), // Show first 50
        message: orphanedFiles.length > 50 ? `...and ${orphanedFiles.length - 50} more` : undefined,
    });
}

/**
 * Analyze GitHub files
 */
async function analyzeGitHubFiles() {
    if (!GITHUB_TOKEN) {
        return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
    }

    const categories = ['h', 'v', 'r18/h', 'r18/v', 'pid/h', 'pid/v', 'tag/h', 'tag/v'];
    const result: Record<string, number> = {};

    for (const cat of categories) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/ri/${cat}?ref=${GITHUB_BRANCH}`,
                {
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                }
            );

            if (response.ok) {
                const files = await response.json();
                result[cat] = Array.isArray(files) ? files.filter((f: { name: string }) => f.name.endsWith('.webp')).length : 0;
            } else {
                result[cat] = 0;
            }
        } catch {
            result[cat] = 0;
        }
    }

    return NextResponse.json({
        categories: result,
        total: Object.values(result).reduce((a, b) => a + b, 0),
    });
}

/**
 * POST - Execute cleanup
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, dryRun = true, category } = body;

        if (action === 'clean-r2') {
            return await cleanR2Orphans(dryRun);
        } else if (action === 'clean-github') {
            if (!category) {
                return NextResponse.json({ error: 'Category required (h, v, r18/h, etc.)' }, { status: 400 });
            }
            return await cleanGitHubCategory(category, dryRun);
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed' },
            { status: 500 }
        );
    }
}

/**
 * Clean orphaned R2 files
 */
async function cleanR2Orphans(dryRun: boolean) {
    const s3Client = getS3Client();
    const bucket = process.env.R2_BUCKET_NAME;

    if (!s3Client || !bucket) {
        return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
    }

    const supabase = createServerClient();

    // Get all R2 URLs from database
    const { data: dbImages } = await supabase
        .from('pixiv_images')
        .select('r2_url')
        .not('r2_url', 'is', null);

    const dbUrls = new Set(dbImages?.map(img => img.r2_url) || []);

    // List all files in R2
    const r2Files: string[] = [];
    let continuationToken: string | undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
        });

        const response = await s3Client.send(command);

        for (const obj of response.Contents || []) {
            if (obj.Key) {
                r2Files.push(obj.Key);
            }
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Find orphaned files
    const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
    const orphanedFiles: string[] = [];

    for (const key of r2Files) {
        const fullUrl = `${r2PublicUrl}/${key}`;
        if (!dbUrls.has(fullUrl)) {
            orphanedFiles.push(key);
        }
    }

    if (dryRun) {
        return NextResponse.json({
            dryRun: true,
            wouldDelete: orphanedFiles.length,
            files: orphanedFiles.slice(0, 20),
            message: 'Set dryRun: false to actually delete',
        });
    }

    // Actually delete files
    let deleted = 0;
    const errors: string[] = [];

    // Delete in batches of 100
    for (let i = 0; i < orphanedFiles.length; i += 100) {
        const batch = orphanedFiles.slice(i, i + 100);

        try {
            if (batch.length === 1) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: bucket,
                    Key: batch[0],
                }));
            } else {
                await s3Client.send(new DeleteObjectsCommand({
                    Bucket: bucket,
                    Delete: {
                        Objects: batch.map(key => ({ Key: key })),
                    },
                }));
            }
            deleted += batch.length;
        } catch (error) {
            errors.push(`Batch ${i}: ${error}`);
        }
    }

    return NextResponse.json({
        dryRun: false,
        deleted,
        errors: errors.length > 0 ? errors : undefined,
    });
}

/**
 * Clean GitHub category (delete all webp files in a category)
 */
async function cleanGitHubCategory(category: string, dryRun: boolean) {
    if (!GITHUB_TOKEN) {
        return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
    }

    const dir = `ri/${category}`;

    // Get files in directory
    const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${dir}?ref=${GITHUB_BRANCH}`,
        {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        }
    );

    if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch directory' }, { status: 500 });
    }

    const files = await response.json();
    const webpFiles = Array.isArray(files)
        ? files.filter((f: { name: string; sha: string }) => f.name.endsWith('.webp'))
        : [];

    if (dryRun) {
        return NextResponse.json({
            dryRun: true,
            category,
            wouldDelete: webpFiles.length,
            files: webpFiles.map((f: { name: string }) => f.name).slice(0, 20),
            message: 'Set dryRun: false to actually delete',
        });
    }

    // Delete files one by one (GitHub API limitation)
    let deleted = 0;
    const errors: string[] = [];

    for (const file of webpFiles) {
        try {
            const deleteResponse = await fetch(
                `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${dir}/${file.name}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: `Delete ${file.name}`,
                        sha: file.sha,
                        branch: GITHUB_BRANCH,
                    }),
                }
            );

            if (deleteResponse.ok) {
                deleted++;
            } else {
                errors.push(`${file.name}: ${deleteResponse.status}`);
            }
        } catch (error) {
            errors.push(`${file.name}: ${error}`);
        }
    }

    // Also clear github_synced in database for this category
    const supabase = createServerClient();
    const categoryPatterns: Record<string, string> = {
        'h': '%/h/%',
        'v': '%/v/%',
        'r18/h': '%R18/h/%',
        'r18/v': '%R18/v/%',
        'pid/h': '%pid/h/%',
        'pid/v': '%pid/v/%',
        'tag/h': '%tag/h/%',
        'tag/v': '%tag/v/%',
    };

    const pattern = categoryPatterns[category];
    if (pattern) {
        await supabase
            .from('pixiv_images')
            .update({ github_synced: null })
            .ilike('r2_url', pattern);
    }

    return NextResponse.json({
        dryRun: false,
        category,
        deleted,
        dbReset: !!pattern,
        errors: errors.length > 0 ? errors : undefined,
    });
}
