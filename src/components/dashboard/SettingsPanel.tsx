"use client";

import React, { useState } from 'react';
import { Settings, Save, Loader2, Lock, Tag, TrendingUp, Flame } from 'lucide-react';

interface SettingsPanelProps {
    initialSettings?: {
        cron_expression: string;
        tags: string[];
        r18_enabled: boolean;
        crawl_limit: number;
        r18_crawl_limit: number;
        tag_search_enabled?: boolean;
        tag_search_limit?: number;
        popularity_filter_auto?: boolean;
        popularity_filter_manual?: boolean;
        popularity_filter_pid?: boolean;
    };
    onSave?: () => void;
}

export default function SettingsPanel({ initialSettings, onSave }: SettingsPanelProps) {
    const [cronExpression, setCronExpression] = useState(
        initialSettings?.cron_expression || '0 0 * * *'
    );
    const [tags, setTags] = useState(
        initialSettings?.tags?.join(', ') || '風景, イラスト'
    );
    const [r18Enabled, setR18Enabled] = useState(
        initialSettings?.r18_enabled || false
    );
    const [crawlLimit, setCrawlLimit] = useState(
        initialSettings?.crawl_limit || 10
    );
    const [r18CrawlLimit, setR18CrawlLimit] = useState(
        initialSettings?.r18_crawl_limit || 10
    );
    const [tagSearchEnabled, setTagSearchEnabled] = useState(
        initialSettings?.tag_search_enabled || false
    );
    const [tagSearchLimit, setTagSearchLimit] = useState(
        initialSettings?.tag_search_limit || 10
    );
    // Popularity filter settings
    const [popularityFilterAuto, setPopularityFilterAuto] = useState(
        initialSettings?.popularity_filter_auto || false
    );
    const [popularityFilterManual, setPopularityFilterManual] = useState(
        initialSettings?.popularity_filter_manual || false
    );
    const [popularityFilterPid, setPopularityFilterPid] = useState(
        initialSettings?.popularity_filter_pid ?? true
    );
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // R18 verification state
    const [showR18Modal, setShowR18Modal] = useState(false);
    const [r18Code, setR18Code] = useState('');
    const [r18Error, setR18Error] = useState('');

    const handleR18Toggle = () => {
        if (r18Enabled) {
            setR18Enabled(false);
        } else {
            setShowR18Modal(true);
            setR18Code('');
            setR18Error('');
        }
    };

    const verifyR18Code = () => {
        if (r18Code === 'wzkws116') {
            setR18Enabled(true);
            setShowR18Modal(false);
            setR18Code('');
            setR18Error('');
        } else {
            setR18Error('验证码错误');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cron_expression: cronExpression,
                    tags: tags.split(',').map(t => t.trim()).filter(t => t),
                    r18_enabled: r18Enabled,
                    crawl_limit: crawlLimit,
                    r18_crawl_limit: r18CrawlLimit,
                    tag_search_enabled: tagSearchEnabled,
                    tag_search_limit: tagSearchLimit,
                    popularity_filter_auto: popularityFilterAuto,
                    popularity_filter_manual: popularityFilterManual,
                    popularity_filter_pid: popularityFilterPid,
                }),
            });

            if (response.ok) {
                setMessage('设置已保存！');
                onSave?.();
            } else {
                const data = await response.json();
                setMessage(`保存失败: ${data.error}`);
            }
        } catch (error) {
            setMessage('保存失败，请重试');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="card-anime p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                        <Settings className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        爬虫设置
                    </h2>
                </div>

                <div className="space-y-5">
                    {/* Cron Expression */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Cron 表达式
                        </label>
                        <input
                            type="text"
                            value={cronExpression}
                            onChange={(e) => setCronExpression(e.target.value)}
                            className="input-anime"
                            placeholder="0 0 * * * (每天 0 点)"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            示例: &quot;0 0 * * *&quot; = 每天0点, &quot;0 */6 * * *&quot; = 每6小时
                        </p>
                    </div>

                    {/* Ranking Source Info */}
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                排行榜 (ranking.php)
                            </span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                            每日热门排行榜，高质量作品，始终启用
                        </p>
                    </div>

                    {/* Ranking Crawl Limits */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                全年龄抓取数量
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="5"
                                    max="30"
                                    step="5"
                                    value={crawlLimit}
                                    onChange={(e) => setCrawlLimit(Number(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <span className="text-sm font-semibold text-purple-500 w-8">{crawlLimit}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                R-18 抓取数量
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="5"
                                    max="30"
                                    step="5"
                                    value={r18CrawlLimit}
                                    onChange={(e) => setR18CrawlLimit(Number(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                                    disabled={!r18Enabled}
                                />
                                <span className={`text-sm font-semibold w-8 ${r18Enabled ? 'text-pink-500' : 'text-gray-400'}`}>
                                    {r18CrawlLimit}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* R-18 Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                R-18 内容
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                开启后将同时抓取 R-18 排行榜
                            </p>
                        </div>
                        <button
                            onClick={handleR18Toggle}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${r18Enabled
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${r18Enabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-700"></div>

                    {/* Tag Search Toggle */}
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                    标签搜索 (可选)
                                </span>
                            </div>
                            <button
                                onClick={() => setTagSearchEnabled(!tagSearchEnabled)}
                                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-300 ${tagSearchEnabled
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                    : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${tagSearchEnabled ? 'translate-x-5' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            按指定标签搜索，存储到独立 tag/ 文件夹
                        </p>
                    </div>

                    {/* Tag Search Settings (shown when enabled) */}
                    {tagSearchEnabled && (
                        <div className="space-y-4 p-4 rounded-xl bg-green-50/50 dark:bg-green-900/10">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    搜索标签 (日语最准确)
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    className="input-anime"
                                    placeholder="風景, 背景, 夜景"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    用逗号分隔多个标签，使用日语标签最准确
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    标签搜索抓取数量
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="5"
                                        max="20"
                                        step="5"
                                        value={tagSearchLimit}
                                        onChange={(e) => setTagSearchLimit(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    />
                                    <span className="text-sm font-semibold text-green-500 w-8">{tagSearchLimit}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-700"></div>

                    {/* Popularity Filter Settings */}
                    <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-2 mb-3">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                热度筛选
                            </span>
                        </div>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mb-3">
                            跳过低热度图片 (热度 = (点赞 + 收藏×2) / 浏览量)
                        </p>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={popularityFilterAuto}
                                    onChange={(e) => setPopularityFilterAuto(e.target.checked)}
                                    className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">自动抓取 (Cron)</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={popularityFilterManual}
                                    onChange={(e) => setPopularityFilterManual(e.target.checked)}
                                    className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">手动抓取</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={popularityFilterPid}
                                    onChange={(e) => setPopularityFilterPid(e.target.checked)}
                                    className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">PID 相关推荐</span>
                            </label>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="anime-button w-full flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        保存设置
                    </button>

                    {message && (
                        <p className={`text-sm text-center ${message.includes('失败') ? 'text-red-500' : 'text-green-500'
                            }`}>
                            {message}
                        </p>
                    )}
                </div>
            </div>

            {/* R18 Verification Modal */}
            {showR18Modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500">
                                <Lock className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                启用 R-18 内容
                            </h3>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            请输入验证码以启用 R-18 内容抓取
                        </p>

                        <input
                            type="password"
                            value={r18Code}
                            onChange={(e) => {
                                setR18Code(e.target.value);
                                setR18Error('');
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && verifyR18Code()}
                            className="input-anime mb-2"
                            placeholder="请输入验证码"
                            autoFocus
                        />

                        {r18Error && (
                            <p className="text-sm text-red-500 mb-3">{r18Error}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowR18Modal(false)}
                                className="flex-1 px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={verifyR18Code}
                                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium hover:opacity-90 transition-opacity"
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
