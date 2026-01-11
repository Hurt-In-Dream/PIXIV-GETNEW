"use client";

import React, { useState, useEffect } from 'react';
import { Github, Upload, Loader2, Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { addActivityLog } from './LogViewer';

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

const ALL_CATEGORIES: SyncCategory[] = ['h', 'v', 'r18h', 'r18v', 'pidh', 'pidv', 'tagh', 'tagv'];

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
    const [syncing, setSyncing] = useState<SyncCategory | 'all' | null>(null);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string>('');

    // Progress tracking
    const [progressData, setProgressData] = useState<{
        current: number;
        total: number;
        category: string;
    } | null>(null);

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

    // Sync a single category until all images are synced
    const syncCategoryFully = async (category: SyncCategory): Promise<number> => {
        let totalUploaded = 0;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await fetch('/api/github-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category, limit: 50 }),
                });

                const data = await response.json();

                if (data.success && data.uploaded > 0) {
                    totalUploaded += data.uploaded;
                    addActivityLog('success', `[GitHub同步] ${CATEGORY_CONFIG[category].label}: 已上传 ${data.uploaded} 张 (共 ${totalUploaded} 张)`);
                    setSyncProgress(`${CATEGORY_CONFIG[category].label}: 已上传 ${totalUploaded} 张...`);

                    // Check if there are more images to sync
                    if (data.uploaded < 50) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                    if (!data.success && data.error) {
                        addActivityLog('error', `[GitHub同步] ${CATEGORY_CONFIG[category].label}: ${data.error}`);
                    }
                }
            } catch (error) {
                addActivityLog('error', `[GitHub同步] ${CATEGORY_CONFIG[category].label}: 网络错误`);
                hasMore = false;
            }
        }

        return totalUploaded;
    };

    const handleSync = async (category: SyncCategory) => {
        setSyncing(category);
        setResult(null);
        addActivityLog('info', `[GitHub同步] 开始同步 ${CATEGORY_CONFIG[category].label}...`);

        const uploaded = await syncCategoryFully(category);

        if (uploaded > 0) {
            setResult({
                success: true,
                message: `成功上传 ${uploaded} 张${CATEGORY_CONFIG[category].label}图片`,
            });
            addActivityLog('success', `[GitHub同步] ${CATEGORY_CONFIG[category].label} 同步完成，共上传 ${uploaded} 张`);
        } else {
            setResult({
                success: true,
                message: `${CATEGORY_CONFIG[category].label}没有需要同步的图片`,
            });
        }

        fetchStatus();
        setSyncing(null);
        setSyncProgress('');
    };

    const handleSyncAll = async () => {
        setSyncing('all');
        setResult(null);
        setSyncProgress('');
        addActivityLog('info', '[GitHub同步] 开始一键同步所有分类...');

        // Calculate total pending for progress
        let totalPendingAll = 0;
        for (const category of ALL_CATEGORIES) {
            const catStatus = status?.categories[category];
            totalPendingAll += (catStatus?.total || 0) - (catStatus?.synced || 0);
        }

        let totalUploaded = 0;
        let processedSoFar = 0;

        for (const category of ALL_CATEGORIES) {
            const catStatus = status?.categories[category];
            const pending = (catStatus?.total || 0) - (catStatus?.synced || 0);

            if (pending <= 0) continue;

            setSyncProgress(`正在同步 ${CATEGORY_CONFIG[category].label}...`);
            setProgressData({
                current: processedSoFar,
                total: totalPendingAll,
                category: CATEGORY_CONFIG[category].label
            });
            addActivityLog('info', `[GitHub同步] 开始同步 ${CATEGORY_CONFIG[category].label} (${pending} 张待传)...`);

            const uploaded = await syncCategoryFully(category);
            totalUploaded += uploaded;
            processedSoFar += pending;

            setProgressData({
                current: processedSoFar,
                total: totalPendingAll,
                category: CATEGORY_CONFIG[category].label
            });

            if (uploaded > 0) {
                addActivityLog('success', `[GitHub同步] ${CATEGORY_CONFIG[category].label} 完成，上传 ${uploaded} 张`);
            }
        }

        setSyncProgress('');
        setProgressData(null);

        if (totalUploaded > 0) {
            setResult({
                success: true,
                message: `全部同步完成！共上传 ${totalUploaded} 张图片`,
            });
            addActivityLog('success', `[GitHub同步] 全部同步完成！共上传 ${totalUploaded} 张图片`);
        } else {
            setResult({
                success: true,
                message: '所有分类都已同步完成',
            });
            addActivityLog('info', '[GitHub同步] 所有分类都已同步完成');
        }

        fetchStatus();
        setSyncing(null);
    };

    // Calculate total pending
    const getTotalPending = () => {
        if (!status?.categories) return 0;
        let total = 0;
        for (const category of ALL_CATEGORIES) {
            const catStatus = status.categories[category];
            if (catStatus) {
                total += catStatus.total - catStatus.synced;
            }
        }
        return total;
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
                    <div className="p-2 rounded-lg bg-gray-400 dark:bg-gray-600">
                        <Github className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-400">GitHub 同步</h2>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">未配置 GITHUB_TOKEN 环境变量</span>
                    </div>
                </div>
            </div>
        );
    }

    const mainCategories: SyncCategory[] = ['h', 'v'];
    const extraCategories: SyncCategory[] = ['r18h', 'r18v', 'pidh', 'pidv', 'tagh', 'tagv'];
    const totalPending = getTotalPending();

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
                    {pending > 0 ? `同步全部 (${pending}张)` : '已同步'}
                </button>
            </div>
        );
    };

    return (
        <div className="card-anime p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-800 dark:bg-gray-200">
                        <Github className="w-5 h-5 text-white dark:text-gray-900" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            GitHub 同步
                        </h2>
                        <p className="text-xs text-gray-500">
                            同步图片到 GitHub 仓库
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

            {/* Sync All Button */}
            <button
                onClick={handleSyncAll}
                disabled={syncing !== null || totalPending === 0}
                className="w-full mb-4 px-4 py-3 rounded-lg bg-gray-800 dark:bg-gray-200 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white dark:text-gray-900 font-medium transition-all flex items-center justify-center gap-2"
            >
                {syncing === 'all' ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {syncProgress || '同步中...'}
                    </>
                ) : (
                    <>
                        <Zap className="w-5 h-5" />
                        一键同步全部 {totalPending > 0 && `(${totalPending} 张待传)`}
                    </>
                )}
            </button>

            {/* Global Progress Bar */}
            {syncing === 'all' && progressData && (
                <div className="mb-4 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            正在同步: {progressData.category}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {progressData.current} / {progressData.total}
                        </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gray-800 dark:bg-gray-200 rounded-full transition-all duration-300"
                            style={{
                                width: progressData.total > 0
                                    ? `${(progressData.current / progressData.total) * 100}%`
                                    : '0%'
                            }}
                        />
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-right">
                        {Math.round((progressData.current / progressData.total) * 100)}%
                    </div>
                </div>
            )}

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
