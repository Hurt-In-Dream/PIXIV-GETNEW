"use client";

import React, { useState, useEffect } from 'react';
import { Github, Upload, Loader2, Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface CategoryStatus {
    total: number;
    synced: number;
    github: number;
}

interface SyncStatus {
    configured: boolean;
    categories: Record<string, CategoryStatus>;
}

type SyncCategory = 'h' | 'v' | 'r18h' | 'r18v' | 'pidh' | 'pidv' | 'tagh' | 'tagv';

const CATEGORY_CONFIG: Record<SyncCategory, { label: string; color: string; bgColor: string }> = {
    h: { label: '排行榜横屏', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    v: { label: '排行榜竖屏', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    r18h: { label: 'R18横屏', color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
    r18v: { label: 'R18竖屏', color: 'text-pink-600', bgColor: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800' },
    pidh: { label: 'PID横屏', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
    pidv: { label: 'PID竖屏', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    tagh: { label: '标签横屏', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
    tagv: { label: '标签竖屏', color: 'text-violet-600', bgColor: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
};

export default function GitHubSync() {
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<SyncCategory | null>(null);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/github-sync');
            const data = await response.json();
            setStatus(data);
        } catch (error) {
            console.error('Failed to fetch sync status:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (category: SyncCategory) => {
        setSyncing(category);
        setResult(null);

        try {
            const response = await fetch('/api/github-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, limit: 10 }),
            });

            const data = await response.json();

            if (data.success) {
                setResult({
                    success: true,
                    message: `成功上传 ${data.uploaded} 张${data.category}图片`,
                });
                fetchStatus();
            } else {
                setResult({
                    success: false,
                    message: data.error || '上传失败',
                });
            }
        } catch {
            setResult({
                success: false,
                message: '网络错误',
            });
        } finally {
            setSyncing(null);
        }
    };

    if (loading) {
        return (
            <div className="card-anime p-6">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
            </div>
        );
    }

    if (!status?.configured) {
        return (
            <div className="card-anime p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600">
                        <Github className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-400">GitHub 同步</h2>
                </div>
                <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">未配置 GITHUB_TOKEN 环境变量</span>
                    </div>
                </div>
            </div>
        );
    }

    // Main categories (ranking)
    const mainCategories: SyncCategory[] = ['h', 'v'];
    // Extra categories
    const extraCategories: SyncCategory[] = ['r18h', 'r18v', 'pidh', 'pidv', 'tagh', 'tagv'];

    const renderCategoryCard = (category: SyncCategory) => {
        const config = CATEGORY_CONFIG[category];
        const catStatus = status.categories[category] || { total: 0, synced: 0, github: 0 };
        const pending = catStatus.total - catStatus.synced;

        return (
            <div key={category} className={`p-3 rounded-xl border ${config.bgColor}`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${config.color}`}>
                        {config.label}
                    </span>
                    <span className={`text-xs ${config.color}`}>
                        GitHub: {catStatus.github}
                    </span>
                </div>
                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">
                    {catStatus.synced} / {catStatus.total}
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                    <div
                        className="h-full bg-current rounded-full transition-all"
                        style={{
                            width: catStatus.total > 0
                                ? `${(catStatus.synced / catStatus.total) * 100}%`
                                : '0%'
                        }}
                    />
                </div>
                <button
                    onClick={() => handleSync(category)}
                    disabled={syncing !== null || pending === 0}
                    className={`w-full mt-2 px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:bg-gray-400 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1`}
                >
                    {syncing === category ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <Upload className="w-3 h-3" />
                    )}
                    {pending > 0 ? `同步 (${pending}待传)` : '已同步'}
                </button>
            </div>
        );
    };

    return (
        <div className="card-anime p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900">
                        <Github className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-gray-600 to-gray-800 dark:from-gray-300 dark:to-gray-100 bg-clip-text text-transparent">
                            GitHub 同步
                        </h2>
                        <p className="text-xs text-gray-500">
                            上传到 EdgeOne_Function_PicAPI
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchStatus}
                    disabled={loading || syncing !== null}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Main Categories (Ranking) */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                {mainCategories.map(renderCategoryCard)}
            </div>

            {/* Expand Button */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
            >
                {expanded ? (
                    <>
                        <ChevronUp className="w-4 h-4" />
                        收起其他分类
                    </>
                ) : (
                    <>
                        <ChevronDown className="w-4 h-4" />
                        展开其他分类 (R18/PID/标签)
                    </>
                )}
            </button>

            {/* Extra Categories */}
            {expanded && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                    {extraCategories.map(renderCategoryCard)}
                </div>
            )}

            {/* Result Message */}
            {result && (
                <div className={`mt-4 p-3 rounded-lg ${result.success
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    }`}>
                    <div className="flex items-center gap-2">
                        {result.success ? (
                            <Check className="w-5 h-5" />
                        ) : (
                            <AlertCircle className="w-5 h-5" />
                        )}
                        <span className="text-sm">{result.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
