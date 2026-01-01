"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    ScrollText,
    RefreshCw,
    Trash2,
    CheckCircle,
    XCircle,
    AlertCircle,
    Info,
    Clock
} from 'lucide-react';

interface LogEntry {
    id: string;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details: string | null;
    created_at: string;
}

const typeConfig = {
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    success: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    warning: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function LogViewer() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('all');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '50' });
            if (filter !== 'all') {
                params.set('level', filter);
            }
            const response = await fetch(`/api/logs?${params}`);
            const data = await response.json();
            setLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchLogs();
        // Auto refresh every 5 seconds
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    const clearLogs = async () => {
        if (!confirm('确定要清空所有日志吗？')) return;

        try {
            await fetch('/api/logs', { method: 'DELETE' });
            setLogs([]);
        } catch (error) {
            console.error('Failed to clear logs:', error);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return '今天';
        }
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="card-anime p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500">
                        <ScrollText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                            活动日志
                        </h2>
                        <p className="text-xs text-gray-500">自动刷新中</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Filter */}
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border-0 focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">全部</option>
                        <option value="info">信息</option>
                        <option value="success">成功</option>
                        <option value="warning">警告</option>
                        <option value="error">错误</option>
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="刷新"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Clear */}
                    <button
                        onClick={clearLogs}
                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                        title="清空日志"
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                </div>
            </div>

            {/* Log List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>暂无活动记录</p>
                        <p className="text-xs mt-1">执行操作后会在这里显示日志</p>
                    </div>
                ) : (
                    logs.map((log) => {
                        const config = typeConfig[log.level] || typeConfig.info;
                        const Icon = config.icon;

                        return (
                            <div
                                key={log.id}
                                className={`flex items-start gap-3 p-3 rounded-xl ${config.bg} transition-all`}
                            >
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        {log.message}
                                    </p>
                                    {log.details && (
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                                            {log.details}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className="text-xs text-gray-400 block">
                                        {formatTime(log.created_at)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {formatDate(log.created_at)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// Export helper function for adding logs (kept for backwards compatibility)
export function addActivityLog(type: 'info' | 'success' | 'warning' | 'error', message: string) {
    // This function is now a no-op since logs are stored server-side
    // The actual logging happens in the API routes via the logger module
    console.log(`[${type.toUpperCase()}] ${message}`);
}

export function clearActivityLogs() {
    // This function is now a no-op
    console.log('Logs are now stored in database, use the clear button in UI');
}
