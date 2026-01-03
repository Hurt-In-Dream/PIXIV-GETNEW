"use client";

import React, { useState } from 'react';
import { Trash2, Loader2, AlertCircle, Check, RefreshCw, Database, Github } from 'lucide-react';

interface AnalysisResult {
    totalR2Files?: number;
    totalDbRecords?: number;
    orphanedCount?: number;
    orphanedFiles?: string[];
    categories?: Record<string, number>;
    total?: number;
}

interface CleanResult {
    dryRun: boolean;
    wouldDelete?: number;
    deleted?: number;
    files?: string[];
    errors?: string[];
}

export default function CleanupTool() {
    const [loading, setLoading] = useState<string | null>(null);
    const [r2Analysis, setR2Analysis] = useState<AnalysisResult | null>(null);
    const [githubAnalysis, setGithubAnalysis] = useState<AnalysisResult | null>(null);
    const [result, setResult] = useState<CleanResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const analyzeR2 = async () => {
        setLoading('analyze-r2');
        setError(null);
        try {
            const response = await fetch('/api/cleanup?target=r2');
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setR2Analysis(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : '分析失败');
        } finally {
            setLoading(null);
        }
    };

    const analyzeGitHub = async () => {
        setLoading('analyze-github');
        setError(null);
        try {
            const response = await fetch('/api/cleanup?target=github');
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setGithubAnalysis(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : '分析失败');
        } finally {
            setLoading(null);
        }
    };

    const cleanR2 = async (dryRun: boolean) => {
        if (!dryRun && !confirm('确定要删除 R2 中的所有孤立文件吗？此操作不可撤销！')) {
            return;
        }

        setLoading(dryRun ? 'preview-r2' : 'clean-r2');
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clean-r2', dryRun }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
            if (!dryRun) analyzeR2(); // Refresh
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败');
        } finally {
            setLoading(null);
        }
    };

    const cleanGitHub = async (category: string, dryRun: boolean) => {
        if (!dryRun && !confirm(`确定要删除 GitHub 中 ${category} 分类的所有图片吗？\n删除后需要重新同步。此操作不可撤销！`)) {
            return;
        }

        setLoading(dryRun ? `preview-${category}` : `clean-${category}`);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clean-github', category, dryRun }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
            if (!dryRun) analyzeGitHub(); // Refresh
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败');
        } finally {
            setLoading(null);
        }
    };

    const categoryLabels: Record<string, string> = {
        'h': '排行榜横屏',
        'v': '排行榜竖屏',
        'r18/h': 'R18横屏',
        'r18/v': 'R18竖屏',
        'pid/h': 'PID横屏',
        'pid/v': 'PID竖屏',
        'tag/h': '标签横屏',
        'tag/v': '标签竖屏',
    };

    return (
        <div className="card-anime p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-rose-500">
                    <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                        清理工具
                    </h2>
                    <p className="text-xs text-gray-500">清理 R2 孤立文件 / GitHub 图片</p>
                </div>
            </div>

            {/* Error display */}
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Result display */}
            {result && (
                <div className={`mb-4 p-3 rounded-lg ${result.dryRun ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600' : 'bg-green-50 dark:bg-green-900/20 text-green-600'} flex items-center gap-2`}>
                    <Check className="w-5 h-5" />
                    <span className="text-sm">
                        {result.dryRun
                            ? `预览: 将删除 ${result.wouldDelete} 个文件`
                            : `已删除 ${result.deleted} 个文件`}
                    </span>
                </div>
            )}

            {/* R2 Cleanup Section */}
            <div className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                    <Database className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">R2 孤立文件清理</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    清理在 R2 中存在但数据库中不存在的文件（之前删除但未同步删除的图片）
                </p>

                <button
                    onClick={analyzeR2}
                    disabled={loading !== null}
                    className="w-full mb-3 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium flex items-center justify-center gap-2"
                >
                    {loading === 'analyze-r2' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    分析 R2 孤立文件
                </button>

                {r2Analysis && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3">
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div>
                                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{r2Analysis.totalR2Files}</div>
                                <div className="text-xs text-gray-500">R2 文件</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{r2Analysis.totalDbRecords}</div>
                                <div className="text-xs text-gray-500">数据库记录</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-red-600">{r2Analysis.orphanedCount}</div>
                                <div className="text-xs text-gray-500">孤立文件</div>
                            </div>
                        </div>
                        {r2Analysis.orphanedCount && r2Analysis.orphanedCount > 0 && (
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => cleanR2(true)}
                                    disabled={loading !== null}
                                    className="flex-1 px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium"
                                >
                                    {loading === 'preview-r2' ? '预览中...' : '预览删除'}
                                </button>
                                <button
                                    onClick={() => cleanR2(false)}
                                    disabled={loading !== null}
                                    className="flex-1 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium"
                                >
                                    {loading === 'clean-r2' ? '删除中...' : '确认删除'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* GitHub Cleanup Section */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                    <Github className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">GitHub 图片管理</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    查看和删除 GitHub 中的同步图片（删除后需要重新同步）
                </p>

                <button
                    onClick={analyzeGitHub}
                    disabled={loading !== null}
                    className="w-full mb-3 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-medium flex items-center justify-center gap-2"
                >
                    {loading === 'analyze-github' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    查看 GitHub 图片统计
                </button>

                {githubAnalysis?.categories && (
                    <div className="space-y-2">
                        {Object.entries(githubAnalysis.categories).map(([category, count]) => (
                            <div key={category} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {categoryLabels[category] || category}
                                    </span>
                                    <span className="text-xs text-gray-500">{count} 张</span>
                                </div>
                                {count > 0 && (
                                    <button
                                        onClick={() => cleanGitHub(category, false)}
                                        disabled={loading !== null}
                                        className="px-2 py-1 rounded text-xs bg-red-500 hover:bg-red-600 text-white"
                                    >
                                        {loading === `clean-${category}` ? '...' : '删除'}
                                    </button>
                                )}
                            </div>
                        ))}
                        <div className="text-center text-sm text-gray-500 pt-2">
                            总计: {githubAnalysis.total} 张图片
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
