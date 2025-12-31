"use client";

import React, { useState } from 'react';
import { Search, Loader2, ImageIcon } from 'lucide-react';
import { addActivityLog } from './LogViewer';

interface Progress {
    total: number;
    processed: number;
    success: number;
    failed: number;
    skipped: number;
}

export default function PidFetcher() {
    const [pid, setPid] = useState('');
    const [fetchRelated, setFetchRelated] = useState(true);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [error, setError] = useState('');

    const handleFetch = async () => {
        if (!pid.trim()) {
            setError('请输入 PID');
            return;
        }

        setLoading(true);
        setProgress(null);
        setError('');
        addActivityLog('info', `开始抓取 PID: ${pid.trim()}...`);

        try {
            const response = await fetch('/api/fetch-pid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pid: pid.trim(),
                    fetchRelated,
                    limit: 5,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                if (data.progress) {
                    setProgress(data.progress);
                    addActivityLog('success', `PID ${pid} 抓取完成: 成功 ${data.progress.success}, 失败 ${data.progress.failed}`);
                } else {
                    setProgress({
                        total: 1,
                        processed: 1,
                        success: data.success && !data.skipped ? 1 : 0,
                        failed: !data.success ? 1 : 0,
                        skipped: data.skipped ? 1 : 0,
                    });
                    addActivityLog(data.success ? 'success' : 'error',
                        data.success ? `PID ${pid} 抓取成功` : `PID ${pid} 抓取失败`);
                }
            } else {
                setError(data.error || '抓取失败');
                addActivityLog('error', `PID ${pid} 抓取失败: ${data.error || '未知错误'}`);
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
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500">
                    <ImageIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    PID 抓取
                </h2>
            </div>

            <div className="space-y-4">
                {/* PID Input */}
                <div className="relative">
                    <input
                        type="text"
                        value={pid}
                        onChange={(e) => setPid(e.target.value)}
                        placeholder="输入 Pixiv 作品 ID (如: 123456789)"
                        className="input-anime pr-12"
                        onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                    />
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>

                {/* Fetch Related Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        同时抓取相关推荐
                    </span>
                    <button
                        onClick={() => setFetchRelated(!fetchRelated)}
                        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-300 ${fetchRelated
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${fetchRelated ? 'translate-x-5' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Fetch Button */}
                <button
                    onClick={handleFetch}
                    disabled={loading}
                    className="anime-button w-full flex items-center justify-center gap-2 !from-blue-500 !via-indigo-500 !to-purple-500 hover:!shadow-blue-500/25"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            抓取中...
                        </>
                    ) : (
                        <>
                            <Search className="w-5 h-5" />
                            开始抓取
                        </>
                    )}
                </button>

                {/* Progress Display */}
                {progress && (
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">总数</span>
                                <span className="font-semibold">{progress.total}</span>
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
                                <div className="flex justify-between">
                                    <span className="text-gray-500">失败</span>
                                    <span className="font-semibold text-red-500">{progress.failed}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <p className="text-sm text-center text-red-500">{error}</p>
                )}
            </div>
        </div>
    );
}
