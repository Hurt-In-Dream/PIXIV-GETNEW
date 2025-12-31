"use client";

import React, { useState, useEffect } from 'react';
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

interface ActivityLog {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    time: Date;
}

const typeConfig = {
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    success: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    warning: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
};

// Global activity log store
let activityLogs: ActivityLog[] = [];
let listeners: Set<() => void> = new Set();

export function addActivityLog(type: ActivityLog['type'], message: string) {
    const log: ActivityLog = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type,
        message,
        time: new Date(),
    };
    activityLogs = [log, ...activityLogs].slice(0, 100); // Keep last 100
    listeners.forEach(fn => fn());
}

export function clearActivityLogs() {
    activityLogs = [];
    listeners.forEach(fn => fn());
}

export default function LogViewer() {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        // Subscribe to log updates
        const update = () => setLogs([...activityLogs]);
        listeners.add(update);
        update(); // Initial load

        return () => {
            listeners.delete(update);
        };
    }, []);

    const filteredLogs = filter === 'all'
        ? logs
        : logs.filter(log => log.type === filter);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('zh-CN', {
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
                            活动日志
                        </h2>
                        <p className="text-xs text-gray-500">实时操作记录</p>
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

                    {/* Clear */}
                    <button
                        onClick={clearActivityLogs}
                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                        title="清空日志"
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                </div>
            </div>

            {/* Log List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>暂无活动记录</p>
                        <p className="text-xs mt-1">执行操作后会在这里显示日志</p>
                    </div>
                ) : (
                    filteredLogs.map((log) => {
                        const config = typeConfig[log.type];
                        const Icon = config.icon;

                        return (
                            <div
                                key={log.id}
                                className={`flex items-start gap-3 p-3 rounded-xl ${config.bg} transition-all`}
                            >
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                                <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                                    {log.message}
                                </p>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                    {formatTime(log.time)}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
