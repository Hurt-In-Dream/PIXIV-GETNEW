"use client";

import React, { useState, useEffect } from 'react';
import { Play, Loader2, Sparkles, Tag, TrendingUp } from 'lucide-react';
import { addActivityLog } from './LogViewer';

interface Progress {
    total: number;
    processed: number;
    success: number;
    failed: number;
    skipped: number;
}

type CrawlMode = 'ranking' | 'tag';

export default function ManualTrigger() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [error, setError] = useState('');
    const [limit, setLimit] = useState(10);
    const [mode, setMode] = useState<CrawlMode>('ranking');
    const [tags, setTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState('');

    // Fetch tags from settings
    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await fetch('/api/settings');
                const data = await response.json();
                if (data.tags && data.tags.length > 0) {
                    setTags(data.tags);
                    setSelectedTag(data.tags[0]);
                }
            } catch (error) {
                console.error('Failed to fetch tags:', error);
            }
        };
        fetchTags();
    }, []);

    const handleTrigger = async () => {
        setLoading(true);
        setProgress(null);
        setError('');

        if (mode === 'ranking') {
            addActivityLog('info', `开始手动抓取排行榜 (${limit}张)...`);
        } else {
            addActivityLog('info', `开始手动抓取标签 "${selectedTag}" (${limit}张)...`);
        }

        try {
            const body: Record<string, unknown> = { mode, limit };
            if (mode === 'tag') {
                body.tag = selectedTag;
            }

            const response = await fetch('/api/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (response.ok) {
                setProgress(data.progress);
                addActivityLog('success', `抓取完成: 成功 ${data.progress.success}, 跳过 ${data.progress.skipped}, 失败 ${data.progress.failed}`);
            } else {
                setError(data.error || '抓取失败');
                addActivityLog('error', `抓取失败: ${data.error || '未知错误'}`);
            }
        } catch (err) {
            setError('网络错误，请重试');
            addActivityLog('error', '网络错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card-anime p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    手动抓取
                </h2>
            </div>

            {/* Mode Selection */}
            <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-2">抓取模式</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => setMode('ranking')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'ranking'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        排行榜
                    </button>
                    <button
                        onClick={() => setMode('tag')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'tag'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        <Tag className="w-4 h-4" />
                        标签搜索
                    </button>
                </div>
            </div>

            {/* Tag Selection (only show when mode is 'tag') */}
            {mode === 'tag' && (
                <div className="mb-4">
                    <label className="block text-xs text-gray-500 mb-2">选择标签</label>
                    {tags.length > 0 ? (
                        <select
                            value={selectedTag}
                            onChange={(e) => setSelectedTag(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm border-none focus:ring-2 focus:ring-orange-500"
                        >
                            {tags.map((tag, index) => (
                                <option key={index} value={tag}>
                                    {tag}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <p className="text-sm text-gray-500">
                            请先在设置中添加搜索标签
                        </p>
                    )}
                </div>
            )}

            {/* Limit Input */}
            <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">抓取数量</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className={`flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer ${mode === 'ranking' ? 'accent-emerald-500' : 'accent-orange-500'
                            }`}
                    />
                    <span className={`text-sm font-semibold w-8 ${mode === 'ranking' ? 'text-emerald-500' : 'text-orange-500'
                        }`}>{limit}</span>
                </div>
            </div>

            <button
                onClick={handleTrigger}
                disabled={loading || (mode === 'tag' && (!selectedTag || tags.length === 0))}
                className={`anime-button w-full flex items-center justify-center gap-2 ${mode === 'ranking'
                        ? '!from-emerald-500 !via-teal-500 !to-cyan-500 hover:!shadow-emerald-500/25'
                        : '!from-orange-500 !via-amber-500 !to-yellow-500 hover:!shadow-orange-500/25'
                    }`}
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        抓取中...
                    </>
                ) : (
                    <>
                        <Play className="w-5 h-5" />
                        {mode === 'ranking' ? '抓取排行榜' : '抓取标签'}
                    </>
                )}
            </button>

            {/* Progress Display */}
            {progress && (
                <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">总数</span>
                            <span className="font-semibold">{progress.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">已处理</span>
                            <span className="font-semibold">{progress.processed}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">成功</span>
                            <span className="font-semibold text-green-500">{progress.success}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">跳过</span>
                            <span className="font-semibold text-yellow-500">{progress.skipped}</span>
                        </div>
                        {progress.failed > 0 && (
                            <div className="flex justify-between col-span-2">
                                <span className="text-gray-500">失败</span>
                                <span className="font-semibold text-red-500">{progress.failed}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <p className="mt-4 text-sm text-center text-red-500">{error}</p>
            )}
        </div>
    );
}
