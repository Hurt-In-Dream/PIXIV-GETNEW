"use client";

import React, { useState } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';

interface SettingsPanelProps {
    initialSettings?: {
        cron_expression: string;
        tags: string[];
        r18_enabled: boolean;
    };
    onSave?: () => void;
}

export default function SettingsPanel({ initialSettings, onSave }: SettingsPanelProps) {
    const [cronExpression, setCronExpression] = useState(
        initialSettings?.cron_expression || '0 0 * * *'
    );
    const [tags, setTags] = useState(
        initialSettings?.tags?.join(', ') || 'イラスト, 二次元, 風景'
    );
    const [r18Enabled, setR18Enabled] = useState(
        initialSettings?.r18_enabled || false
    );
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

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

                {/* Tags */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        目标标签 (Tags)
                    </label>
                    <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="input-anime"
                        placeholder="イラスト, 二次元, 風景"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        用逗号分隔多个标签，优先使用日文标签
                    </p>
                </div>

                {/* R-18 Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            R-18 内容
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            开启后将抓取 R-18 排行榜
                        </p>
                    </div>
                    <button
                        onClick={() => setR18Enabled(!r18Enabled)}
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
    );
}
