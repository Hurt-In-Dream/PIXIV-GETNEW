/**
 * Pixiv Authentication Module
 * Supports PHPSESSID cookie-based authentication
 */

export interface PixivAuthHeaders {
    Cookie: string;
    'User-Agent': string;
    Referer: string;
    Accept: string;
    'Accept-Language': string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Get authentication headers for Pixiv requests
 */
export function getPixivAuthHeaders(): Record<string, string> {
    const phpSessId = process.env.PIXIV_PHPSESSID;

    if (!phpSessId) {
        throw new Error('PIXIV_PHPSESSID is not configured');
    }

    return {
        Cookie: `PHPSESSID=${phpSessId}`,
        'User-Agent': USER_AGENT,
        Referer: 'https://www.pixiv.net/',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
    };
}

/**
 * Get headers for downloading images (anti-hotlinking bypass)
 */
export function getPixivImageHeaders(): Record<string, string> {
    return {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.pixiv.net/',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    };
}

/**
 * Validate PHPSESSID is configured
 */
export function isAuthenticated(): boolean {
    return !!process.env.PIXIV_PHPSESSID;
}
