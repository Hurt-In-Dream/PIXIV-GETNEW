"use client";

import React, { useEffect, useState } from 'react';
import {
    SettingsPanel,
    ManualTrigger,
    PidFetcher,
    ImageGallery,
    LogViewer
} from '@/components/dashboard';
import { Sparkles, Github, Heart } from 'lucide-react';

interface Settings {
    cron_expression: string;
    tags: string[];
    r18_enabled: boolean;
    crawl_limit: number;
    r18_crawl_limit: number;
}

export default function Dashboard() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            setSettings(data);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const handleSettingsSave = () => {
        fetchSettings();
        setRefreshKey(k => k + 1);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-gray-900/80 border-b border-white/5">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 blur opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse-soft" />
                                <div className="relative p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                                    Pixiv-Vercel-Sync
                                </h1>
                                <p className="text-xs text-gray-400">
                                    图片自动同步系统
                                </p>
                            </div>
                        </div>

                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <Github className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
                        </a>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        label="状态"
                        value="在线"
                        color="from-green-500 to-emerald-500"
                    />
                    <StatCard
                        label="Cron"
                        value={settings?.cron_expression || '加载中...'}
                        color="from-blue-500 to-indigo-500"
                    />
                    <StatCard
                        label="标签数"
                        value={String(settings?.tags?.length || 0)}
                        color="from-purple-500 to-pink-500"
                    />
                    <StatCard
                        label="R-18"
                        value={settings?.r18_enabled ? '开启' : '关闭'}
                        color="from-rose-500 to-red-500"
                    />
                </div>

                {/* Dashboard Grid */}
                <div className="grid lg:grid-cols-3 gap-6 mb-8">
                    {/* Left Column - Settings */}
                    <div className="lg:col-span-1 space-y-6">
                        {settings && (
                            <SettingsPanel
                                initialSettings={settings}
                                onSave={handleSettingsSave}
                            />
                        )}
                    </div>

                    {/* Right Column - Actions */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <ManualTrigger />
                            <PidFetcher />
                        </div>
                    </div>
                </div>

                {/* Log Viewer */}
                <div className="mb-8">
                    <LogViewer />
                </div>

                {/* Image Gallery */}
                <ImageGallery key={refreshKey} />
            </main>

            {/* Footer */}
            <footer className="container mx-auto px-4 py-8 text-center">
                <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    Made with <Heart className="w-4 h-4 text-pink-500 animate-pulse" /> for anime lovers
                </p>
            </footer>
        </div>
    );
}

function StatCard({
    label,
    value,
    color
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-xl bg-gray-800/50 backdrop-blur-sm border border-white/5 p-4">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${color} opacity-10 rounded-full blur-2xl`} />
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-lg font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent truncate`}>
                {value}
            </p>
        </div>
    );
}
