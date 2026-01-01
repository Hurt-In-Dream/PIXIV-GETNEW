"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Filter,
    Plus,
    Trash2,
    Loader2,
    X
} from 'lucide-react';

interface SkipTag {
    id: string;
    tag: string;
    translation: string | null;
    category: string;
}

const categoryLabels: Record<string, string> = {
    background: '🖼️ 背景',
    style: '🎨 风格',
    type: '📚 类型',
    ai: '🤖 AI',
    color: '🎭 色彩',
    text: '📝 文字',
    format: '📐 格式',
    vtuber: '📺 VTuber',
    meta: '🏷️ 元数据',
    draft: '✏️ 草稿',
    other: '📦 其他',
};

export default function SkipTagsManager() {
    const [tags, setTags] = useState<SkipTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [newTranslation, setNewTranslation] = useState('');
    const [newCategory, setNewCategory] = useState('other');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const fetchTags = useCallback(async () => {
        try {
            const response = await fetch('/api/skip-tags');
            const data = await response.json();
            setTags(data.tags || []);
        } catch (error) {
            console.error('Failed to fetch skip tags:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    const handleAdd = async () => {
        if (!newTag.trim()) {
            setError('标签不能为空');
            return;
        }

        setAdding(true);
        setError('');

        try {
            const response = await fetch('/api/skip-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag: newTag,
                    translation: newTranslation,
                    category: newCategory,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setTags(prev => [...prev, data.tag]);
                setNewTag('');
                setNewTranslation('');
                setNewCategory('other');
                setShowAddModal(false);
            } else {
                setError(data.error || '添加失败');
            }
        } catch (error) {
            setError('添加失败');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这个过滤标签吗？')) return;

        try {
            await fetch('/api/skip-tags', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setTags(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Failed to delete tag:', error);
        }
    };

    // Group tags by category
    const groupedTags = tags.reduce((acc, tag) => {
        const cat = tag.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(tag);
        return acc;
    }, {} as Record<string, SkipTag[]>);

    return (
        <>
            <div className="card-anime p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-orange-500">
                            <Filter className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                                过滤标签
                            </h2>
                            <p className="text-xs text-gray-500">包含这些标签的图片将被跳过</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" />
                        添加
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    </div>
                ) : tags.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Filter className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>暂无过滤标签</p>
                        <p className="text-xs mt-1">点击上方"添加"按钮添加标签</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {Object.entries(groupedTags).map(([category, categoryTags]) => (
                            <div key={category}>
                                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                    {categoryLabels[category] || category}
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th className="text-left py-2 px-2 font-medium text-gray-500">标签</th>
                                                <th className="text-left py-2 px-2 font-medium text-gray-500">翻译</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categoryTags.map(tag => (
                                                <tr key={tag.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <td className="py-2 px-2 font-mono text-xs">{tag.tag}</td>
                                                    <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{tag.translation || '-'}</td>
                                                    <td className="py-2 px-2">
                                                        <button
                                                            onClick={() => handleDelete(tag.id)}
                                                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                添加过滤标签
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    标签 (Pixiv原始标签)
                                </label>
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    className="input-anime"
                                    placeholder="例如: 透過png, chibi, 漫画"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    翻译 (可选)
                                </label>
                                <input
                                    type="text"
                                    value={newTranslation}
                                    onChange={(e) => setNewTranslation(e.target.value)}
                                    className="input-anime"
                                    placeholder="例如: 透明PNG, Q版, 漫画"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    分类
                                </label>
                                <select
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    className="input-anime"
                                >
                                    {Object.entries(categoryLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            {error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}

                            <button
                                onClick={handleAdd}
                                disabled={adding}
                                className="anime-button w-full flex items-center justify-center gap-2"
                            >
                                {adding ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Plus className="w-5 h-5" />
                                )}
                                添加标签
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
