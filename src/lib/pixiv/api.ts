/**
 * Pixiv API Module
 * Core API interactions for fetching illustrations
 */

import axios from 'axios';
import { getPixivAuthHeaders } from './auth';

// API Base URLs
const PIXIV_AJAX_BASE = 'https://www.pixiv.net/ajax';
const PIXIV_TOUCH_API = 'https://www.pixiv.net/touch/ajax';

// Response types
export interface PixivIllust {
    id: string;
    title: string;
    userName: string;
    userId: string;
    tags: string[];
    urls: {
        thumb?: string;
        small?: string;
        regular?: string;
        original?: string;
    };
    pageCount: number;
    width: number;
    height: number;
    createDate: string;
    // Popularity metrics for quality filtering
    bookmarkCount?: number;  // 收藏数
    likeCount?: number;      // 点赞数
    viewCount?: number;      // 浏览量
}

export interface PixivIllustDetail {
    id: string;
    title: string;
    description: string;
    userName: string;
    userId: string;
    tags: { tag: string; translation?: { en?: string } }[];
    urls: {
        mini?: string;
        thumb?: string;
        small?: string;
        regular?: string;
        original?: string;
    };
    pageCount: number;
    width: number;
    height: number;
    createDate: string;
}

export interface PixivRankingItem {
    illust_id: number;
    title: string;
    user_name: string;
    user_id: number;
    tags: string[];
    url: string;
    width: number;
    height: number;
}

export interface FetchResult {
    success: boolean;
    illustrations: PixivIllust[];
    error?: string;
}

/**
 * Get axios instance with auth headers
 */
function getApiClient() {
    return axios.create({
        headers: getPixivAuthHeaders(),
        timeout: 30000,
    });
}

/**
 * Fetch illustration details by PID
 */
export async function getIllustDetail(pid: number | string): Promise<PixivIllustDetail | null> {
    try {
        const client = getApiClient();
        const response = await client.get(`${PIXIV_AJAX_BASE}/illust/${pid}`);

        if (response.data.error) {
            console.error('Pixiv API error:', response.data.message);
            return null;
        }

        return response.data.body;
    } catch (error) {
        console.error('Failed to fetch illust detail:', error);
        return null;
    }
}

/**
 * Fetch all pages of a multi-page illustration
 */
export async function getIllustPages(pid: number | string): Promise<string[]> {
    try {
        const client = getApiClient();
        const response = await client.get(`${PIXIV_AJAX_BASE}/illust/${pid}/pages`);

        if (response.data.error) {
            return [];
        }

        return response.data.body.map((page: { urls: { original: string } }) => page.urls.original);
    } catch (error) {
        console.error('Failed to fetch illust pages:', error);
        return [];
    }
}

/**
 * Fetch daily ranking
 * @param mode - Ranking mode: 'daily', 'weekly', 'monthly', 'daily_r18', etc.
 * @param page - Page number (0-indexed)
 * @param date - Date in YYYYMMDD format (optional)
 */
export async function getRanking(
    mode: string = 'daily',
    page: number = 1,
    date?: string
): Promise<FetchResult> {
    try {
        const client = getApiClient();
        const params: Record<string, string | number> = {
            mode,
            p: page,
            format: 'json',
        };

        if (date) {
            params.date = date;
        }

        const response = await client.get('https://www.pixiv.net/ranking.php', { params });

        // Debug: log response status and structure
        console.log(`[Pixiv API] ranking.php response status: ${response.status}`);
        console.log(`[Pixiv API] response has contents: ${!!response.data.contents}`);
        console.log(`[Pixiv API] response keys: ${Object.keys(response.data || {}).join(', ')}`);

        if (!response.data.contents) {
            // Check if this is an auth error (Pixiv redirects to login)
            const isAuthError = response.data.error ||
                response.request?.responseURL?.includes('login') ||
                !response.data.mode;

            return {
                success: false,
                illustrations: [],
                error: isAuthError
                    ? 'PHPSESSID expired or invalid - please update your Pixiv session'
                    : 'No contents in response'
            };
        }

        const illustrations: PixivIllust[] = response.data.contents.map((item: PixivRankingItem) => ({
            id: String(item.illust_id),
            title: item.title,
            userName: item.user_name,
            userId: String(item.user_id),
            tags: item.tags || [],
            urls: {
                regular: item.url,
            },
            pageCount: 1,
            width: item.width,
            height: item.height,
            createDate: '',
        }));

        return { success: true, illustrations };
    } catch (error) {
        console.error('Failed to fetch ranking:', error);
        return {
            success: false,
            illustrations: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Search illustrations by tag
 * @param tag - Search tag
 * @param page - Page number (1-indexed)
 */
export async function searchByTag(tag: string, page: number = 1): Promise<FetchResult> {
    try {
        const client = getApiClient();
        const encodedTag = encodeURIComponent(tag);

        const response = await client.get(
            `${PIXIV_AJAX_BASE}/search/artworks/${encodedTag}`,
            {
                params: {
                    word: tag,
                    order: 'popular_d',
                    mode: 'all',
                    p: page,
                    s_mode: 's_tag',
                    type: 'all',
                },
            }
        );

        if (response.data.error) {
            return { success: false, illustrations: [], error: response.data.message };
        }

        const data = response.data.body.illustManga?.data || [];

        const illustrations: PixivIllust[] = data.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            title: String(item.title || ''),
            userName: String(item.userName || ''),
            userId: String(item.userId || ''),
            tags: Array.isArray(item.tags) ? item.tags : [],
            urls: {
                regular: String(item.url || ''),
            },
            pageCount: Number(item.pageCount) || 1,
            width: Number(item.width) || 0,
            height: Number(item.height) || 0,
            createDate: String(item.createDate || ''),
        }));

        return { success: true, illustrations };
    } catch (error) {
        console.error('Failed to search by tag:', error);
        return {
            success: false,
            illustrations: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Fetch related works for a given PID
 */
export async function getRelatedWorks(pid: number | string, limit: number = 20): Promise<FetchResult> {
    try {
        const client = getApiClient();

        const response = await client.get(
            `${PIXIV_AJAX_BASE}/illust/${pid}/recommend/init`,
            {
                params: {
                    limit,
                },
            }
        );

        if (response.data.error) {
            return { success: false, illustrations: [], error: response.data.message };
        }

        const illusts = response.data.body.illusts || [];

        const illustrations: PixivIllust[] = illusts.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            title: String(item.title || ''),
            userName: String(item.userName || ''),
            userId: String(item.userId || ''),
            tags: Array.isArray(item.tags) ? item.tags : [],
            urls: item.urls as PixivIllust['urls'],
            pageCount: Number(item.pageCount) || 1,
            width: Number(item.width) || 0,
            height: Number(item.height) || 0,
            createDate: String(item.createDate || ''),
            // Popularity metrics
            bookmarkCount: Number(item.bookmarkCount) || 0,
            likeCount: Number(item.likeCount) || 0,
            viewCount: Number(item.viewCount) || 0,
        }));

        return { success: true, illustrations };
    } catch (error) {
        console.error('Failed to fetch related works:', error);
        return {
            success: false,
            illustrations: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Fetch artist's works
 */
export async function getArtistWorks(userId: number | string, limit: number = 30): Promise<FetchResult> {
    try {
        const client = getApiClient();

        // First get the list of illustration IDs
        const profileResponse = await client.get(`${PIXIV_AJAX_BASE}/user/${userId}/profile/all`);

        if (profileResponse.data.error) {
            return { success: false, illustrations: [], error: profileResponse.data.message };
        }

        const illustIds = Object.keys(profileResponse.data.body.illusts || {}).slice(0, limit);

        if (illustIds.length === 0) {
            return { success: true, illustrations: [] };
        }

        // Fetch illustration details in chunks
        const illustrations: PixivIllust[] = [];
        const chunkSize = 10;

        for (let i = 0; i < illustIds.length; i += chunkSize) {
            const chunk = illustIds.slice(i, i + chunkSize);
            const detailsPromises = chunk.map(id => getIllustDetail(id));
            const details = await Promise.all(detailsPromises);

            for (const detail of details) {
                if (detail) {
                    illustrations.push({
                        id: detail.id,
                        title: detail.title,
                        userName: detail.userName,
                        userId: detail.userId,
                        tags: detail.tags.map(t => t.tag),
                        urls: detail.urls,
                        pageCount: detail.pageCount,
                        width: detail.width,
                        height: detail.height,
                        createDate: detail.createDate,
                    });
                }
            }
        }

        return { success: true, illustrations };
    } catch (error) {
        console.error('Failed to fetch artist works:', error);
        return {
            success: false,
            illustrations: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
