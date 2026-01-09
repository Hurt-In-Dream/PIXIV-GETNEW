/**
 * 企业微信 Webhook 消息推送
 * 用于在自动抓取完成后发送通知
 */

import { logInfo, logError } from './logger';

// 企业微信 Webhook 消息类型
interface TextMessage {
    msgtype: 'text';
    text: {
        content: string;
        mentioned_list?: string[];
        mentioned_mobile_list?: string[];
    };
}

interface MarkdownMessage {
    msgtype: 'markdown';
    markdown: {
        content: string;
    };
}

type WeChatMessage = TextMessage | MarkdownMessage;

// 抓取结果统计
export interface CrawlStats {
    ranking: { success: number; failed: number; skipped: number };
    r18: { success: number; failed: number; skipped: number };
    tag: { success: number; failed: number; skipped: number };
    favorite: { success: number; failed: number; skipped: number };
}

// 抓取报告详情
export interface CrawlReport {
    stats: CrawlStats;
    totalSuccess: number;
    totalFailed: number;
    totalSkipped: number;
    duration: number; // 秒
    tags?: string[]; // 本次抓取的标签
    r18Enabled: boolean;
    tagSearchEnabled: boolean;
    timestamp: Date;
}

/**
 * 获取 Webhook URL
 */
function getWebhookUrl(): string | null {
    return process.env.WECOM_WEBHOOK_URL || null;
}

/**
 * 发送消息到企业微信
 */
async function sendMessage(message: WeChatMessage): Promise<boolean> {
    const result = await sendMessageWithDebug(message);
    return result.success;
}

/**
 * 发送消息结果（含调试信息）
 */
export interface SendMessageResult {
    success: boolean;
    webhookUrl?: string;
    httpStatus?: number;
    apiResponse?: {
        errcode: number;
        errmsg: string;
    };
    error?: string;
    requestBody?: string;
}

/**
 * 发送消息到企业微信（带调试信息）
 */
export async function sendMessageWithDebug(message: WeChatMessage): Promise<SendMessageResult> {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        await logInfo('[Webhook] 未配置企业微信 Webhook URL，跳过推送');
        return {
            success: false,
            error: '未配置 WECOM_WEBHOOK_URL 环境变量'
        };
    }

    const requestBody = JSON.stringify(message);

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: requestBody,
        });

        const responseText = await response.text();
        let apiResponse;

        try {
            apiResponse = JSON.parse(responseText);
        } catch {
            return {
                success: false,
                webhookUrl: webhookUrl.substring(0, 60) + '...',
                httpStatus: response.status,
                error: `无法解析响应: ${responseText}`,
                requestBody: requestBody.substring(0, 200) + '...',
            };
        }

        if (!response.ok) {
            await logError('[Webhook] 发送失败', `HTTP ${response.status}: ${responseText}`);
            return {
                success: false,
                webhookUrl: webhookUrl.substring(0, 60) + '...',
                httpStatus: response.status,
                apiResponse,
                error: `HTTP 错误: ${response.status}`,
                requestBody: requestBody.substring(0, 200) + '...',
            };
        }

        if (apiResponse.errcode !== 0) {
            await logError('[Webhook] 发送失败', `错误码: ${apiResponse.errcode}, 消息: ${apiResponse.errmsg}`);
            return {
                success: false,
                webhookUrl: webhookUrl.substring(0, 60) + '...',
                httpStatus: response.status,
                apiResponse,
                error: `企业微信 API 错误: ${apiResponse.errmsg}`,
                requestBody: requestBody.substring(0, 200) + '...',
            };
        }

        await logInfo('[Webhook] 消息推送成功');
        return {
            success: true,
            webhookUrl: webhookUrl.substring(0, 60) + '...',
            httpStatus: response.status,
            apiResponse,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError('[Webhook] 发送异常', errorMessage);
        return {
            success: false,
            webhookUrl: webhookUrl.substring(0, 60) + '...',
            error: errorMessage,
            requestBody: requestBody.substring(0, 200) + '...',
        };
    }
}

/**
 * 格式化时间持续时间
 */
function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds.toFixed(1)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}分${remainingSeconds}秒`;
}

/**
 * 获取状态 Emoji
 */
function getStatusEmoji(success: number, failed: number): string {
    if (failed > 0 && success === 0) return '❌';
    if (failed > 0) return '⚠️';
    if (success > 0) return '✅';
    return '➖';
}

/**
 * 生成抓取报告的 Markdown 内容
 */
function generateCrawlReportMarkdown(report: CrawlReport): string {
    const { stats, totalSuccess, totalFailed, totalSkipped, duration, tags, r18Enabled, tagSearchEnabled, timestamp } = report;

    // 整体状态
    const overallStatus = totalFailed > 0 ? (totalSuccess > 0 ? '⚠️ 部分成功' : '❌ 抓取失败') : '✅ 抓取成功';
    const statusColor = totalFailed > 0 ? 'warning' : 'info';

    // 格式化时间
    const timeStr = timestamp.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let content = `# 🖼️ Pixiv 自动抓取报告\n`;
    content += `> 执行时间: ${timeStr}\n\n`;

    // 总体统计
    content += `## 📊 总体统计\n`;
    content += `<font color="${statusColor}">${overallStatus}</font>\n`;
    content += `> 新增: <font color="info">**${totalSuccess}**</font> 张\n`;
    content += `> 失败: <font color="${totalFailed > 0 ? 'warning' : 'comment'}">${totalFailed}</font> 张\n`;
    content += `> 跳过: <font color="comment">${totalSkipped}</font> 张\n`;
    content += `> 耗时: <font color="comment">${formatDuration(duration)}</font>\n\n`;

    // 分类详情
    content += `## 📋 分类详情\n`;

    // 排行榜
    const rankingEmoji = getStatusEmoji(stats.ranking.success, stats.ranking.failed);
    content += `${rankingEmoji} **排行榜**: ${stats.ranking.success} 成功`;
    if (stats.ranking.failed > 0) content += ` / ${stats.ranking.failed} 失败`;
    if (stats.ranking.skipped > 0) content += ` / ${stats.ranking.skipped} 跳过`;
    content += `\n`;

    // R18
    if (r18Enabled) {
        const r18Emoji = getStatusEmoji(stats.r18.success, stats.r18.failed);
        content += `${r18Emoji} **R18排行**: ${stats.r18.success} 成功`;
        if (stats.r18.failed > 0) content += ` / ${stats.r18.failed} 失败`;
        if (stats.r18.skipped > 0) content += ` / ${stats.r18.skipped} 跳过`;
        content += `\n`;
    }

    // 标签搜索
    if (tagSearchEnabled) {
        const tagEmoji = getStatusEmoji(stats.tag.success, stats.tag.failed);
        content += `${tagEmoji} **标签搜索**: ${stats.tag.success} 成功`;
        if (stats.tag.failed > 0) content += ` / ${stats.tag.failed} 失败`;
        if (stats.tag.skipped > 0) content += ` / ${stats.tag.skipped} 跳过`;
        content += `\n`;
    }

    // 智能抓取
    const totalFavorite = stats.favorite.success + stats.favorite.failed + stats.favorite.skipped;
    if (totalFavorite > 0) {
        const favEmoji = getStatusEmoji(stats.favorite.success, stats.favorite.failed);
        content += `${favEmoji} **智能推荐**: ${stats.favorite.success} 成功`;
        if (stats.favorite.failed > 0) content += ` / ${stats.favorite.failed} 失败`;
        if (stats.favorite.skipped > 0) content += ` / ${stats.favorite.skipped} 跳过`;
        content += `\n`;
    }

    // 本次涉及的标签
    if (tags && tags.length > 0) {
        content += `\n## 🏷️ 抓取标签\n`;
        content += tags.map(tag => `\`${tag}\``).join(' ');
        content += `\n`;
    }

    return content;
}

/**
 * 发送抓取完成通知
 * @param report 抓取报告
 */
export async function sendCrawlNotification(report: CrawlReport): Promise<boolean> {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        return false; // 未配置则静默跳过
    }

    const content = generateCrawlReportMarkdown(report);

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    return sendMessage(message);
}

/**
 * 发送简单文本通知
 * @param content 消息内容
 */
export async function sendTextNotification(content: string): Promise<boolean> {
    const message: TextMessage = {
        msgtype: 'text',
        text: { content }
    };

    return sendMessage(message);
}

/**
 * 发送错误报警
 * @param error 错误信息
 * @param context 上下文描述
 */
export async function sendErrorAlert(error: string, context?: string): Promise<boolean> {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        return false;
    }

    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let content = `# ❌ Pixiv 抓取异常\n`;
    content += `> 时间: ${timestamp}\n\n`;
    if (context) {
        content += `**场景**: ${context}\n\n`;
    }
    content += `**错误**: <font color="warning">${error}</font>`;

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    return sendMessage(message);
}

/**
 * 检查 Webhook 是否已配置
 */
export function isWebhookConfigured(): boolean {
    return !!getWebhookUrl();
}

/**
 * 抓取类型枚举
 */
export type CrawlType = 'auto' | 'manual' | 'pid' | 'tag';

/**
 * 获取抓取类型的中文名称
 */
function getCrawlTypeName(type: CrawlType): string {
    const names: Record<CrawlType, string> = {
        auto: '自动定时',
        manual: '手动',
        pid: 'PID',
        tag: '标签搜索',
    };
    return names[type] || type;
}

/**
 * 发送抓取开始通知
 * @param type 抓取类型
 * @param details 额外详情（如 PID、标签名等）
 */
export async function sendCrawlStartNotification(
    type: CrawlType,
    details?: { limit?: number; pid?: number; tag?: string; r18Enabled?: boolean }
): Promise<boolean> {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        return false;
    }

    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const typeName = getCrawlTypeName(type);

    let content = `# 🚀 开始${typeName}抓取\n`;
    content += `> 时间: ${timestamp}\n\n`;

    // 添加详情
    if (details) {
        if (details.limit) {
            content += `**目标数量**: ${details.limit} 张\n`;
        }
        if (details.pid) {
            content += `**PID**: ${details.pid}\n`;
        }
        if (details.tag) {
            content += `**标签**: \`${details.tag}\`\n`;
        }
        if (details.r18Enabled) {
            content += `**R18**: 已启用\n`;
        }
    }

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    return sendMessage(message);
}

/**
 * 简化版抓取完成通知（用于手动抓取和 PID 抓取）
 */
export interface SimpleCrawlReport {
    type: CrawlType;
    success: number;
    failed: number;
    skipped: number;
    duration: number; // 秒
    details?: { pid?: number; tag?: string };
}

/**
 * 发送简化版抓取完成通知
 */
export async function sendSimpleCrawlNotification(report: SimpleCrawlReport): Promise<boolean> {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        return false;
    }

    const { type, success, failed, skipped, duration, details } = report;
    const typeName = getCrawlTypeName(type);
    const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    // 整体状态
    const overallStatus = failed > 0 ? (success > 0 ? '⚠️ 部分成功' : '❌ 抓取失败') : '✅ 抓取成功';
    const statusColor = failed > 0 ? 'warning' : 'info';

    let content = `# 🖼️ ${typeName}抓取完成\n`;
    content += `> 时间: ${timestamp}\n\n`;

    // 详情
    if (details?.pid) {
        content += `**PID**: ${details.pid}\n`;
    }
    if (details?.tag) {
        content += `**标签**: \`${details.tag}\`\n`;
    }

    content += `\n## 📊 统计\n`;
    content += `<font color="${statusColor}">${overallStatus}</font>\n`;
    content += `> 新增: <font color="info">**${success}**</font> 张\n`;
    content += `> 失败: <font color="${failed > 0 ? 'warning' : 'comment'}">${failed}</font> 张\n`;
    content += `> 跳过: <font color="comment">${skipped}</font> 张\n`;
    content += `> 耗时: <font color="comment">${formatDuration(duration)}</font>\n`;

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    return sendMessage(message);
}
