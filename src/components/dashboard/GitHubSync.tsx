"use client";

import React, { useState, useEffect } from 'react';
import { Github, Upload, Loader2, Check, AlertCircle, Monitor, Smartphone } from 'lucide-react';

interface SyncStatus {
    configured: boolean;
    horizontal: { total: number; synced: number };
    vertical: { total: number; synced: number };
}

export default function GitHubSync() {
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<'h' | 'v' | null>(null);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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

    const handleSync = async (orientation: 'h' | 'v') => {
        setSyncing(orientation);
        setResult(null);

        try {
            const response = await fetch('/api/github-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orientation, limit: 10 }),
            });

            const data = await response.json();

            if (data.success) {
                setResult({
                    success: true,
                    message: `成功上传 ${data.uploaded} 张${orientation === 'h' ? '横屏' : '竖屏'}图片`,
                });
                fetchStatus(); // Refresh status
            } else {
                setResult({
                    success: false,
                    message: data.error || '上传失败',
                });
            }
        } catch (error) {
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
                    <h2 className="text-xl font-bold text-gray-400">
                        GitHub 同步
                    </h2>
                </div>
                <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">未配置 GITHUB_TOKEN 环境变量</span>
                    </div>
                    <p className="text-xs text-yellow-500 mt-1">
                        请在 Vercel 环境变量中添加 GITHUB_TOKEN 以启用此功能
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="card-anime p-6">
            <div className="flex items-center gap-3 mb-4">
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

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                将排行榜图片同步到 GitHub 仓库，自动编号为 1.webp, 2.webp...
            </p>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Horizontal */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Monitor className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            横屏 (ri/h)
                        </span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {status.horizontal.synced} / {status.horizontal.total}
                    </div>
                    <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full mt-2 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                            style={{
                                width: status.horizontal.total > 0
                                    ? `${(status.horizontal.synced / status.horizontal.total) * 100}%`
                                    : '0%'
                            }}
                        />
                    </div>
                    <button
                        onClick={() => handleSync('h')}
                        disabled={syncing !== null || status.horizontal.synced >= status.horizontal.total}
                        className="w-full mt-3 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {syncing === 'h' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                同步中...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                同步横屏
                            </>
                        )}
                    </button>
                </div>

                {/* Vertical */}
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                        <Smartphone className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                            竖屏 (ri/v)
                        </span>
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {status.vertical.synced} / {status.vertical.total}
                    </div>
                    <div className="h-2 bg-green-200 dark:bg-green-800 rounded-full mt-2 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                            style={{
                                width: status.vertical.total > 0
                                    ? `${(status.vertical.synced / status.vertical.total) * 100}%`
                                    : '0%'
                            }}
                        />
                    </div>
                    <button
                        onClick={() => handleSync('v')}
                        disabled={syncing !== null || status.vertical.synced >= status.vertical.total}
                        className="w-full mt-3 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {syncing === 'v' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                同步中...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                同步竖屏
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Result Message */}
            {result && (
                <div className={`p-3 rounded-lg ${result.success
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
