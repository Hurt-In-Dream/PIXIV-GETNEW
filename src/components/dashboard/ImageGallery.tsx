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
    Trash2,
    X,
    Filter,
    Plus,
    FolderOpen,
    Heart,
    ImageOff
} from 'lucide-react';

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

type ImageSource = 'ranking' | 'r18' | 'tag' | 'pid' | 'all';

const SOURCE_OPTIONS: { value: ImageSource; label: string }[] = [
    { value: 'ranking', label: '排行榜' },
    { value: 'tag', label: '标签搜索' },
    { value: 'pid', label: 'PID抓取' },
    { value: 'r18', label: 'R-18' },
    { value: 'all', label: '全部' },
];

const PAGE_SIZE_OPTIONS = [12, 24, 36, 48];

// Image fallback sources
const getImageSources = (pid: number, r2Url: string | null, originalUrl?: string): string[] => {
    const sources: string[] = [];

    // 1. R2 storage (fastest if available)
    if (r2Url) sources.push(r2Url);

    // 2. i.yuki.sh mirror (use original pximg path)
    if (originalUrl) {
        // Convert: https://i.pximg.net/... -> https://i.yuki.sh/...
        const yukiUrl = originalUrl.replace('i.pximg.net', 'i.yuki.sh');
        sources.push(yukiUrl);
    }

    // 3. Other Pixiv proxy mirrors as fallback
    sources.push(`https://pixiv.re/${pid}.jpg`);
    sources.push(`https://pixiv.nl/${pid}.jpg`);
    sources.push(`https://i.pixiv.re/${pid}.jpg`);

    return sources;
};

// Optimized Image Component with loading state and fallback
function GalleryImage({
    image,
    onLike,
    onCopy,
    onDelete,
    copiedId
}: {
    image: PixivImage;
    onLike: (image: PixivImage, e: React.MouseEvent) => void;
    onCopy: (url: string, id: string) => void;
    onDelete: (image: PixivImage) => void;
    copiedId: string | null;
}) {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

    const sources = getImageSources(image.pid, image.r2_url, image.original_url);
    const currentSrc = sources[currentSourceIndex];

    const handleError = () => {
        if (currentSourceIndex < sources.length - 1) {
            setCurrentSourceIndex(prev => prev + 1);
            setImgLoaded(false);
        } else {
            setImgError(true);
        }
    };

    const handleLoad = () => {
        setImgLoaded(true);
    };

    return (
        <div className="group relative break-inside-avoid rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-4">
            {/* Loading skeleton */}
            {!imgLoaded && !imgError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700 animate-pulse">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs">加载中...</span>
                    </div>
                </div>
            )}

            {/* Error state */}
            {imgError && (
                <div className="aspect-square flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <ImageOff className="w-8 h-8" />
                        <span className="text-xs">加载失败</span>
                        <a
                            href={`https://www.pixiv.net/artworks/${image.pid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline"
                        >
                            在 Pixiv 查看
                        </a>
                    </div>
                </div>
            )}

            {/* Image */}
            {!imgError && (
                <img
                    src={currentSrc}
                    alt={image.title}
                    className={`w-full h-auto object-cover transition-all duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'
                        } group-hover:scale-105`}
                    loading="lazy"
                    onLoad={handleLoad}
                    onError={handleError}
                />
            )}

            {/* Overlay - only show when loaded */}
            {imgLoaded && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-medium truncate">
                            {image.title}
                        </p>
                        <p className="text-white/70 text-xs truncate">
                            by {image.artist}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                            {/* Like Button */}
                            <button
                                onClick={(e) => onLike(image, e)}
                                className="p-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 transition-colors"
                                title="喜欢这张图的标签"
                            >
                                <Heart className="w-4 h-4 text-pink-400" />
                            </button>

                            {/* Copy R2 URL */}
                            {image.r2_url && (
                                <button
                                    onClick={() => onCopy(image.r2_url!, image.id)}
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
                                onClick={() => onDelete(image)}
                                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors ml-auto"
                                title="删除"
                            >
                                <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PID Badge */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-mono">
                {image.pid}
            </div>
        </div>
    );
}

export default function ImageGallery() {
    const [images, setImages] = useState<PixivImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [source, setSource] = useState<ImageSource>('ranking');
    const [pageSize, setPageSize] = useState(12);

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<PixivImage | null>(null);
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    // Like modal state
    const [likeModalOpen, setLikeModalOpen] = useState(false);
    const [imageToLike, setImageToLike] = useState<PixivImage | null>(null);
    const [likedTags, setLikedTags] = useState<Set<string>>(new Set());
    const [liking, setLiking] = useState(false);
    const [likeSuccess, setLikeSuccess] = useState(false);

    const fetchImages = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/images?page=${page}&limit=${pageSize}&source=${source}`);
            const data: PaginatedResponse = await response.json();

            setImages(data.images);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (error) {
            console.error('Failed to fetch images:', error);
        } finally {
            setLoading(false);
        }
    }, [page, source, pageSize]);

    useEffect(() => {
        fetchImages();
    }, [fetchImages]);

    // Reset to page 1 when source or pageSize changes
    const handleSourceChange = (newSource: ImageSource) => {
        setSource(newSource);
        setPage(1);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
    };

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const openDeleteModal = (image: PixivImage) => {
        setImageToDelete(image);
        setSelectedTags(new Set());
        setDeleteModalOpen(true);
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
    };

    const confirmDelete = async () => {
        if (!imageToDelete) return;

        setDeleting(true);

        try {
            // Delete the image
            const deleteResponse = await fetch('/api/images', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: imageToDelete.id }),
            });

            if (!deleteResponse.ok) {
                throw new Error('Failed to delete image');
            }

            // Add selected tags to filter list
            if (selectedTags.size > 0) {
                const tagsArray = Array.from(selectedTags);
                for (let i = 0; i < tagsArray.length; i++) {
                    await fetch('/api/skip-tags', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tag: tagsArray[i],
                            translation: null,
                            category: 'user',
                        }),
                    });
                }
            }

            // Close modal and refresh
            setDeleteModalOpen(false);
            setImageToDelete(null);
            setSelectedTags(new Set());
            fetchImages();
        } catch (error) {
            console.error('Failed to delete image:', error);
        } finally {
            setDeleting(false);
        }
    };

    // Like functionality
    const openLikeModal = (image: PixivImage, e: React.MouseEvent) => {
        e.stopPropagation();
        setImageToLike(image);
        setLikedTags(new Set());
        setLikeSuccess(false);
        setLikeModalOpen(true);
    };

    const toggleLikedTag = (tag: string) => {
        setLikedTags(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
    };

    const confirmLike = async () => {
        if (!imageToLike || likedTags.size === 0) return;

        setLiking(true);

        try {
            const tagsArray = Array.from(likedTags);
            for (const tag of tagsArray) {
                await fetch('/api/favorite-tags', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tag, tag_jp: tag }),
                });
            }

            setLikeSuccess(true);
            setTimeout(() => {
                setLikeModalOpen(false);
                setImageToLike(null);
                setLikedTags(new Set());
                setLikeSuccess(false);
            }, 1500);
        } catch (error) {
            console.error('Failed to like tags:', error);
        } finally {
            setLiking(false);
        }
    };

    return (
        <>
            <div className="card-anime p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-800 dark:bg-gray-200">
                            <Images className="w-5 h-5 text-white dark:text-gray-900" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
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

                {/* Source Filter */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <div className="flex items-center gap-1 text-sm text-gray-500 mr-2">
                        <FolderOpen className="w-4 h-4" />
                        <span>来源:</span>
                    </div>
                    {SOURCE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleSourceChange(option.value)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${source === option.value
                                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-gray-500">每页显示:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="px-3 py-1 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-0 focus:ring-2 focus:ring-gray-500/20"
                    >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                                {size} 张
                            </option>
                        ))}
                    </select>
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
                        {/* Masonry Image Grid */}
                        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                            {images.map((image) => (
                                <GalleryImage
                                    key={image.id}
                                    image={image}
                                    onLike={openLikeModal}
                                    onCopy={copyToClipboard}
                                    onDelete={openDeleteModal}
                                    copiedId={copiedId}
                                />
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

            {/* Like Modal - Select Favorite Tags */}
            {likeModalOpen && imageToLike && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Heart className="w-5 h-5 text-pink-500" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    喜欢的标签
                                </h3>
                            </div>
                            <button
                                onClick={() => setLikeModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Image Preview */}
                        <div className="mb-4">
                            <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2">
                                <img
                                    src={imageToLike.r2_url || `https://pixiv.re/${imageToLike.pid}.jpg`}
                                    alt={imageToLike.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = `https://pixiv.re/${imageToLike.pid}.jpg`;
                                    }}
                                />
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {imageToLike.title}
                            </p>
                        </div>

                        {/* Tag Selection */}
                        {imageToLike.tags && imageToLike.tags.length > 0 ? (
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    选择你喜欢的标签，以后会优先抓取带有这些标签的图片：
                                </p>
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                                    {imageToLike.tags.map((tag, index) => (
                                        <button
                                            key={index}
                                            onClick={() => toggleLikedTag(tag)}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${likedTags.has(tag)
                                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {likedTags.has(tag) && <Heart className="w-3 h-3 fill-current" />}
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                {likedTags.size > 0 && (
                                    <p className="text-xs text-pink-500 mt-2 flex items-center gap-1">
                                        <Heart className="w-3 h-3 fill-current" />
                                        已选择 {likedTags.size} 个喜欢的标签
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mb-4">这张图片没有标签信息</p>
                        )}

                        {/* Success Message */}
                        {likeSuccess && (
                            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center gap-2">
                                <Check className="w-5 h-5" />
                                <span className="text-sm">标签已添加到喜欢列表！</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setLikeModalOpen(false)}
                                className="flex-1 px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmLike}
                                disabled={liking || likedTags.size === 0 || likeSuccess}
                                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {liking ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Heart className="w-4 h-4" />
                                )}
                                确认喜欢
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal with Tag Selection */}
            {deleteModalOpen && imageToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                删除图片
                            </h3>
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Image Preview */}
                        <div className="mb-4">
                            <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2">
                                <img
                                    src={imageToDelete.r2_url || `https://pixiv.re/${imageToDelete.pid}.jpg`}
                                    alt={imageToDelete.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = `https://pixiv.re/${imageToDelete.pid}.jpg`;
                                    }}
                                />
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {imageToDelete.title}
                            </p>
                            <p className="text-xs text-gray-500">PID: {imageToDelete.pid}</p>
                        </div>

                        {/* Tag Selection */}
                        {imageToDelete.tags && imageToDelete.tags.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Filter className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        添加标签到过滤列表 (可选)
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">
                                    选中的标签将被加入过滤列表，以后抓取时会自动跳过带有这些标签的图片
                                </p>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                                    {imageToDelete.tags.map((tag, index) => (
                                        <button
                                            key={index}
                                            onClick={() => toggleTag(tag)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${selectedTags.has(tag)
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {selectedTags.has(tag) && <Plus className="w-3 h-3" />}
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                {selectedTags.size > 0 && (
                                    <p className="text-xs text-orange-500 mt-2">
                                        将添加 {selectedTags.size} 个标签到过滤列表
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="flex-1 px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                {selectedTags.size > 0 ? '删除并过滤' : '确认删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
