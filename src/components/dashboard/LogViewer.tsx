"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    ScrollText,
    RefreshCw,
    Trash2,
    CheckCircle,
    XCircle,
    AlertCircle,
    Info
} from 'lucide-react';

interface LogEntry {
    id: string;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: string;
    created_at: string;
}

const levelConfig = {
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    success: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    warning: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
};

export default function LogViewer() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/logs?limit=50&level=${filter}`);
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
    }, [fetchLogs]);

    const clearLogs = async () => {
        if (!confirm('确定要清空所有日志吗？')) return;

        try {
            await fetch('/api/logs', { method: 'DELETE' });
            fetchLogs();
        } catch (error) {
            console.error('Failed to clear logs:', error);
        }
    };

    const formatTime = (date: string) => {
        return new Date(date).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
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
                            运行日志
                        </h2>
                        <p className="text-xs text-gray-500">共 {logs.length} 条记录</p>
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
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>暂无日志</p>
                    </div>
                ) : (
                    logs.map((log) => {
                        const config = levelConfig[log.level];
                        const Icon = config.icon;

                        return (
                            <div
                                key={log.id}
                                className={`flex items-start gap-3 p-3 rounded-xl ${config.bg} transition-all hover:scale-[1.01]`}
                            >
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        {log.message}
                                    </p>
                                    {log.details && (
                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                            {log.details}
                                        </p>
                                    )}
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                    {formatTime(log.created_at)}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
