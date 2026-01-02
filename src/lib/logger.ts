/**
 * Logger Module
 * Saves logs to Supabase for dashboard display
 * Automatically keeps only the latest 50 logs
 */

import { createServerClient } from './supabase';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
    level: LogLevel;
    message: string;
    details?: string;
}

// Maximum number of logs to keep
const MAX_LOGS = 50;

// Track cleanup to avoid running too frequently
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 60000; // 1 minute

/**
 * Clean up old logs, keeping only the latest MAX_LOGS
 */
async function cleanupOldLogs(): Promise<void> {
    const now = Date.now();

    // Only run cleanup once per minute to avoid excessive queries
    if (now - lastCleanupTime < CLEANUP_INTERVAL) {
        return;
    }

    lastCleanupTime = now;

    try {
        const supabase = createServerClient();

        // Get the ID of the 50th newest log
        const { data: logs } = await supabase
            .from('crawler_logs')
            .select('id, created_at')
            .order('created_at', { ascending: false })
            .range(MAX_LOGS, MAX_LOGS);

        if (logs && logs.length > 0) {
            // Delete all logs older than the 50th
            const cutoffTime = logs[0].created_at;

            await supabase
                .from('crawler_logs')
                .delete()
                .lt('created_at', cutoffTime);
        }
    } catch (error) {
        // Silently fail - cleanup should not break the main flow
        console.error('Failed to cleanup logs:', error);
    }
}

/**
 * Save a log entry to the database
 */
export async function saveLog(entry: LogEntry): Promise<void> {
    try {
        const supabase = createServerClient();

        await supabase.from('crawler_logs').insert({
            level: entry.level,
            message: entry.message,
            details: entry.details || null,
        });

        // Cleanup old logs periodically
        cleanupOldLogs().catch(() => { });
    } catch (error) {
        // Silently fail - logging should not break the main flow
        console.error('Failed to save log:', error);
    }
}

/**
 * Log info message
 */
export async function logInfo(message: string, details?: string): Promise<void> {
    console.log(`[INFO] ${message}`, details || '');
    await saveLog({ level: 'info', message, details });
}

/**
 * Log success message
 */
export async function logSuccess(message: string, details?: string): Promise<void> {
    console.log(`[SUCCESS] ${message}`, details || '');
    await saveLog({ level: 'success', message, details });
}

/**
 * Log warning message
 */
export async function logWarning(message: string, details?: string): Promise<void> {
    console.warn(`[WARNING] ${message}`, details || '');
    await saveLog({ level: 'warning', message, details });
}

/**
 * Log error message
 */
export async function logError(message: string, details?: string): Promise<void> {
    console.error(`[ERROR] ${message}`, details || '');
    await saveLog({ level: 'error', message, details });
}

/**
 * Log activity with specified level
 */
export async function logActivity(level: LogLevel, message: string, details?: string): Promise<void> {
    switch (level) {
        case 'info':
            await logInfo(message, details);
            break;
        case 'success':
            await logSuccess(message, details);
            break;
        case 'warning':
            await logWarning(message, details);
            break;
        case 'error':
            await logError(message, details);
            break;
    }
}

