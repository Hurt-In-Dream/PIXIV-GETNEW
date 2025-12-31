"use client";

import React, { useState } from 'react';
import { Play, Loader2, Sparkles } from 'lucide-react';
import { addActivityLog } from './LogViewer';

interface Progress {
    total: number;
    processed: number;
    success: number;
    failed: number;
    skipped: number;
}

export default function ManualTrigger() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [error, setError] = useState('');
    const [limit, setLimit] = useState(10);

    const handleTrigger = async () => {
        setLoading(true);
        setProgress(null);
        setError('');
        addActivityLog('info', `开始手动抓取排行榜 (${limit}张)...`);

        try {
            const response = await fetch('/api/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'ranking', limit }),
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

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                从每日排行榜抓取最新的图片
            </p>

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
                        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-sm font-semibold text-emerald-500 w-8">{limit}</span>
                </div>
            </div>

            <button
                onClick={handleTrigger}
                disabled={loading}
                className="anime-button w-full flex items-center justify-center gap-2 !from-emerald-500 !via-teal-500 !to-cyan-500 hover:!shadow-emerald-500/25"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        抓取中...
                    </>
                ) : (
                    <>
                        <Play className="w-5 h-5" />
                        开始抓取
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
