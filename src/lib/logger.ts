/**
 * Logger Module
 * Saves logs to Supabase for dashboard display
 */

import { createServerClient } from './supabase';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
    level: LogLevel;
    message: string;
    details?: string;
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
