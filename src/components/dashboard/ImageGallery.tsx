"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Images,
    Copy,
    Check,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    Trash2
} from 'lucide-react';
// Removed unused utils import

interface PixivImage {
    id: string;
    pid: number;
    title: string;
    artist: string;
    tags: string[];
    original_url: string;
    r2_url: string | null;
    created_at: string;
}

interface PaginatedResponse {
    images: PixivImage[];
    total: number;
    page: number;
    totalPages: number;
}

export default function ImageGallery() {
    const [images, setImages] = useState<PixivImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchImages = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/images?page=${page}&limit=12`);
            const data: PaginatedResponse = await response.json();

            setImages(data.images);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (error) {
            console.error('Failed to fetch images:', error);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchImages();
    }, [fetchImages]);

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const deleteImage = async (id: string) => {
        if (!confirm('确定要删除这张图片吗？')) return;

        try {
            const response = await fetch('/api/images', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (response.ok) {
                fetchImages();
            }
        } catch (error) {
            console.error('Failed to delete image:', error);
        }
    };

    return (
        <div className="card-anime p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
                        <Images className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                            图库
                        </h2>
                        <p className="text-xs text-gray-500">共 {total} 张图片</p>
                    </div>
                </div>

                <button
                    onClick={fetchImages}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading && images.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : images.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <Images className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无图片</p>
                    <p className="text-sm mt-1">开始抓取以添加图片到图库</p>
                </div>
            ) : (
                <>
                    {/* Image Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((image) => (
                            <div
                                key={image.id}
                                className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"
                            >
                                {/* Image */}
                                <img
                                    src={image.r2_url || `https://pixiv.re/${image.pid}.jpg`}
                                    alt={image.title}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    loading="lazy"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        if (target.src !== `https://pixiv.re/${image.pid}.jpg`) {
                                            target.src = `https://pixiv.re/${image.pid}.jpg`;
                                        }
                                    }}
                                />

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                        <p className="text-white text-sm font-medium truncate">
                                            {image.title}
                                        </p>
                                        <p className="text-white/70 text-xs truncate">
                                            by {image.artist}
                                        </p>

                                        <div className="flex items-center gap-2 mt-2">
                                            {/* Copy R2 URL */}
                                            {image.r2_url && (
                                                <button
                                                    onClick={() => copyToClipboard(image.r2_url!, image.id)}
                                                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                                                    title="复制 R2 链接"
                                                >
                                                    {copiedId === image.id ? (
                                                        <Check className="w-4 h-4 text-green-400" />
                                                    ) : (
                                                        <Copy className="w-4 h-4 text-white" />
                                                    )}
                                                </button>
                                            )}

                                            {/* Open Pixiv */}
                                            <a
                                                href={`https://www.pixiv.net/artworks/${image.pid}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                                                title="在 Pixiv 查看"
                                            >
                                                <ExternalLink className="w-4 h-4 text-white" />
                                            </a>

                                            {/* Delete */}
                                            <button
                                                onClick={() => deleteImage(image.id)}
                                                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors ml-auto"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* PID Badge */}
                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs font-mono">
                                    {image.pid}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {page} / {totalPages}
                            </span>

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
