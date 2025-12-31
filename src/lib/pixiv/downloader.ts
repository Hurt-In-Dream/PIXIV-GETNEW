/**
 * Pixiv Image Downloader
 * Downloads images with proper anti-hotlinking headers
 */

import axios from 'axios';
import { getPixivImageHeaders } from './auth';
import { getIllustDetail, getIllustPages } from './api';
import { getExtensionFromUrl } from '../utils';

export interface DownloadedImage {
    pid: number;
    page: number;
    buffer: Buffer;
    contentType: string;
    extension: string;
    originalUrl: string;
}

export interface DownloadResult {
    success: boolean;
    images: DownloadedImage[];
    error?: string;
}

export interface ImageInfo {
    pid: number;
    title: string;
    artist: string;
    tags: string[];
    originalUrls: string[];
}

/**
 * Get image info and all original URLs for an illustration
 */
export async function getImageInfo(pid: number | string): Promise<ImageInfo | null> {
    try {
        const detail = await getIllustDetail(pid);
        if (!detail) return null;

        let originalUrls: string[] = [];

        if (detail.pageCount > 1) {
            // Multi-page illustration
            originalUrls = await getIllustPages(pid);
        } else if (detail.urls.original) {
            // Single page
            originalUrls = [detail.urls.original];
        } else if (detail.urls.regular) {
            // Fallback to regular if original not available
            // Convert regular URL to original format
            const regularUrl = detail.urls.regular;
            const originalUrl = regularUrl
                .replace('/c/540x540_70/', '/img-original/')
                .replace('/c/600x600/', '/img-original/')
                .replace('/c/250x250_80_a2/', '/img-original/')
                .replace('_master1200', '')
                .replace('_square1200', '');
            originalUrls = [originalUrl];
        }

        // Handle different tag formats from Pixiv API
        let tags: string[] = [];
        if (detail.tags) {
            if (Array.isArray(detail.tags)) {
                // Format: [{tag: "xxx"}, ...] or ["xxx", ...]
                tags = detail.tags.map((t: unknown) => {
                    if (typeof t === 'string') return t;
                    if (typeof t === 'object' && t !== null && 'tag' in t) {
                        return String((t as { tag: string }).tag);
                    }
                    return '';
                }).filter(Boolean);
            } else if (typeof detail.tags === 'object' && 'tags' in detail.tags) {
                // Format: {tags: [{tag: "xxx"}, ...]}
                const tagsObj = detail.tags as { tags: Array<{ tag: string }> };
                tags = tagsObj.tags.map(t => t.tag || '').filter(Boolean);
            }
        }

        return {
            pid: parseInt(String(pid)),
            title: detail.title || 'Untitled',
            artist: detail.userName || 'Unknown',
            tags,
            originalUrls,
        };
    } catch (error) {
        console.error('Failed to get image info:', error);
        return null;
    }
}

/**
 * Download a single image from Pixiv
 */
export async function downloadImage(
    url: string,
    pid: number,
    page: number = 0
): Promise<DownloadedImage | null> {
    try {
        const headers = getPixivImageHeaders();

        const response = await axios.get(url, {
            headers,
            responseType: 'arraybuffer',
            timeout: 60000, // 60 second timeout for large images
        });

        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const extension = getExtensionFromUrl(url);

        return {
            pid,
            page,
            buffer,
            contentType,
            extension,
            originalUrl: url,
        };
    } catch (error) {
        console.error(`Failed to download image from ${url}:`, error);
        return null;
    }
}

/**
 * Download all pages of an illustration
 * @param pid - Pixiv illustration ID
 * @param maxPages - Maximum number of pages to download (for multi-page works)
 */
export async function downloadIllustration(
    pid: number | string,
    maxPages: number = 10
): Promise<DownloadResult> {
    try {
        const info = await getImageInfo(pid);
        if (!info) {
            return { success: false, images: [], error: 'Failed to get illustration info' };
        }

        const urls = info.originalUrls.slice(0, maxPages);
        const images: DownloadedImage[] = [];

        for (let i = 0; i < urls.length; i++) {
            const image = await downloadImage(urls[i], info.pid, i);
            if (image) {
                images.push(image);
            }
        }

        return {
            success: images.length > 0,
            images,
            error: images.length === 0 ? 'No images downloaded' : undefined,
        };
    } catch (error) {
        console.error('Failed to download illustration:', error);
        return {
            success: false,
            images: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
