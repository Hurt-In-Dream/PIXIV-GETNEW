/**
 * 消息推送模块
 * 支持企业微信 Webhook 和 Qmsg酱 QQ消息推送
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
 * 获取企业微信 Webhook URL
 */
function getWebhookUrl(): string | null {
    return process.env.WECOM_WEBHOOK_URL || null;
}

/**
 * 获取 Qmsg酱 Key
 */
function getQmsgKey(): string | null {
    return process.env.QMSG_KEY || null;
}

/**
 * 检查 Qmsg酱 是否已配置
 */
export function isQmsgConfigured(): boolean {
    return !!getQmsgKey();
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
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    let content = `**🖼️ Pixiv 自动抓取报告**\n`;
    content += `<font color="${statusColor}">${overallStatus}</font>\n\n`;

    // 核心统计 - 简洁明了
    content += `> ✨ **新增** <font color="info">${totalSuccess}</font> 张`;
    if (totalFailed > 0) content += ` | ❌ **失败** <font color="warning">${totalFailed}</font>`;
    if (totalSkipped > 0) content += ` | ⏭ **跳过** ${totalSkipped}`;
    content += `\n`;
    content += `> ⏱ 耗时 ${formatDuration(duration)} | 📅 ${timeStr}\n\n`;

    // 分类统计 - 使用简洁格式
    const categories: string[] = [];

    if (stats.ranking.success > 0 || stats.ranking.failed > 0) {
        categories.push(`📊排行榜: ${stats.ranking.success}`);
    }
    if (r18Enabled && (stats.r18.success > 0 || stats.r18.failed > 0)) {
        categories.push(`🔞R18: ${stats.r18.success}`);
    }
    if (tagSearchEnabled && (stats.tag.success > 0 || stats.tag.failed > 0)) {
        categories.push(`🏷️标签: ${stats.tag.success}`);
    }
    const totalFavorite = stats.favorite.success + stats.favorite.failed + stats.favorite.skipped;
    if (totalFavorite > 0) {
        categories.push(`🧠智能: ${stats.favorite.success}`);
    }

    if (categories.length > 0) {
        content += categories.join(' | ') + `\n`;
    }

    // 本次涉及的标签
    if (tags && tags.length > 0) {
        content += `\n🏷️ ` + tags.map(tag => `\`${tag}\``).join(' ');
    }

    return content;
}

/**
 * 发送抓取完成通知
 * @param report 抓取报告
 */
export async function sendCrawlNotification(report: CrawlReport): Promise<boolean> {
    const content = generateCrawlReportMarkdown(report);

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    // 先发送企业微信
    const wecomResult = await sendMessage(message);

    // 再发送 Qmsg酱（纯文本格式）
    const plainText = generateCrawlReportPlainText(report);
    await sendQmsgMessage(plainText);

    return wecomResult;
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
    const timeStr = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // 简洁的错误通知 (Markdown)
    let content = `**❌ 抓取异常**`;
    if (context) {
        content += ` - ${context}`;
    }
    content += `\n`;
    content += `> <font color="warning">${error}</font>\n`;
    content += `> 📅 ${timeStr}`;

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    // 先发送企业微信
    const wecomResult = await sendMessage(message);

    // 再发送 Qmsg酱（纯文本格式）
    const plainText = generateErrorPlainText(error, context);
    await sendQmsgMessage(plainText);

    return wecomResult;
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
    const typeName = getCrawlTypeName(type);
    const timeStr = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // 简洁的开始通知 (Markdown)
    let content = `**🚀 开始${typeName}抓取**\n`;

    // 详情使用引用样式
    const detailParts: string[] = [];
    if (details?.limit) detailParts.push(`🎯 目标 ${details.limit} 张`);
    if (details?.pid) detailParts.push(`🎴 PID \`${details.pid}\``);
    if (details?.tag) detailParts.push(`🏷️ \`${details.tag}\``);
    if (details?.r18Enabled) detailParts.push(`🔞 R18`);

    if (detailParts.length > 0) {
        content += `> ` + detailParts.join(' | ') + `\n`;
    }
    content += `> 📅 ${timeStr}`;

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    // 先发送企业微信
    const wecomResult = await sendMessage(message);

    // 再发送 Qmsg酱（纯文本格式）
    const plainText = generateStartPlainText(type, details);
    await sendQmsgMessage(plainText);

    return wecomResult;
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

    // 整体状态
    const overallStatus = failed > 0 ? (success > 0 ? '⚠️ 部分成功' : '❌ 失败') : '✅ 成功';
    const statusColor = failed > 0 ? 'warning' : 'info';

    // 简洁的完成通知
    let content = `**🖼️ ${typeName}抓取完成** <font color="${statusColor}">${overallStatus}</font>\n`;

    // 详情部分
    if (details?.pid) {
        content += `> 🎴 PID \`${details.pid}\`\n`;
    }
    if (details?.tag) {
        content += `> 🏷️ 标签 \`${details.tag}\`\n`;
    }

    // 统计信息 - 单行展示
    content += `> ✨ **+${success}** 新增`;
    if (failed > 0) content += ` | ❌ ${failed} 失败`;
    if (skipped > 0) content += ` | ⏭ ${skipped} 跳过`;
    content += ` | ⏱ ${formatDuration(duration)}`;

    const message: MarkdownMessage = {
        msgtype: 'markdown',
        markdown: { content }
    };

    // 先发送企业微信
    const wecomResult = await sendMessage(message);

    // 再发送 Qmsg酱（纯文本格式）
    const plainText = generateSimpleCrawlPlainText(report);
    await sendQmsgMessage(plainText);

    return wecomResult;
}

// ============================================
// Qmsg酱 消息推送相关函数
// ============================================

/**
 * Qmsg酱 API 响应格式
 */
export interface QmsgResponse {
    success: boolean;
    reason: string;
    code: number;
    info?: { msgId: number };
}

/**
 * Qmsg酱 发送结果
 */
export interface QmsgResult {
    success: boolean;
    httpStatus?: number;
    response?: QmsgResponse;
    error?: string;
}

/**
 * 发送消息到 Qmsg酱
 * @param msg 消息内容（纯文本，不支持富文本）
 */
export async function sendQmsgMessage(msg: string): Promise<QmsgResult> {
    const qmsgKey = getQmsgKey();

    if (!qmsgKey) {
        return {
            success: false,
            error: '未配置 QMSG_KEY 环境变量'
        };
    }

    const url = `https://qmsg.zendee.cn/send/${qmsgKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `msg=${encodeURIComponent(msg)}`,
        });

        const data: QmsgResponse = await response.json();

        if (data.success) {
            await logInfo('[Qmsg] 消息推送成功');
            return {
                success: true,
                httpStatus: response.status,
                response: data,
            };
        } else {
            await logError('[Qmsg] 发送失败', `${data.reason} (code: ${data.code})`);
            return {
                success: false,
                httpStatus: response.status,
                response: data,
                error: data.reason,
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError('[Qmsg] 发送异常', errorMessage);
        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * 发送 Qmsg酱 消息并返回详细调试信息
 */
export async function sendQmsgWithDebug(msg: string): Promise<QmsgResult> {
    return sendQmsgMessage(msg);
}

/**
 * 将 Markdown 内容转换为纯文本（用于 Qmsg酱）
 * 去除所有富文本格式：图片、链接、HTML标签等
 */
function markdownToPlainText(markdown: string): string {
    return markdown
        // 移除 HTML 标签（如 <font color="...">）
        .replace(/<[^>]+>/g, '')
        // 移除 Markdown 链接 [text](url) -> text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // 移除代码块 `code` -> code
        .replace(/`([^`]+)`/g, '$1')
        // 移除加粗 **text** -> text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        // 移除斜体 *text* -> text
        .replace(/\*([^*]+)\*/g, '$1')
        // 移除引用前缀 > 
        .replace(/^>\s*/gm, '')
        // 移除标题前缀 # ## ### 等
        .replace(/^#+\s*/gm, '')
        // 合并多余空行
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * 生成抓取报告纯文本（用于 Qmsg酱）
 */
function generateCrawlReportPlainText(report: CrawlReport): string {
    const { stats, totalSuccess, totalFailed, totalSkipped, duration, tags, r18Enabled, tagSearchEnabled, timestamp } = report;

    const overallStatus = totalFailed > 0 ? (totalSuccess > 0 ? '⚠️ 部分成功' : '❌ 失败') : '✅ 成功';

    const timeStr = timestamp.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    let text = `🖼️ Pixiv 自动抓取报告\n`;
    text += `${overallStatus}\n\n`;
    text += `✨ 新增 ${totalSuccess} 张`;
    if (totalFailed > 0) text += ` | ❌ 失败 ${totalFailed}`;
    if (totalSkipped > 0) text += ` | ⏭ 跳过 ${totalSkipped}`;
    text += `\n⏱ 耗时 ${formatDuration(duration)} | 📅 ${timeStr}\n\n`;

    // 分类统计
    const categories: string[] = [];
    if (stats.ranking.success > 0 || stats.ranking.failed > 0) {
        categories.push(`📊排行榜: ${stats.ranking.success}`);
    }
    if (r18Enabled && (stats.r18.success > 0 || stats.r18.failed > 0)) {
        categories.push(`🔞R18: ${stats.r18.success}`);
    }
    if (tagSearchEnabled && (stats.tag.success > 0 || stats.tag.failed > 0)) {
        categories.push(`🏷️标签: ${stats.tag.success}`);
    }
    const totalFavorite = stats.favorite.success + stats.favorite.failed + stats.favorite.skipped;
    if (totalFavorite > 0) {
        categories.push(`🧠智能: ${stats.favorite.success}`);
    }

    if (categories.length > 0) {
        text += categories.join(' | ') + `\n`;
    }

    // 标签
    if (tags && tags.length > 0) {
        text += `\n🏷️ ` + tags.join(' ');
    }

    return text;
}

/**
 * 生成开始抓取纯文本（用于 Qmsg酱）
 */
function generateStartPlainText(type: CrawlType, details?: { limit?: number; pid?: number; tag?: string; r18Enabled?: boolean }): string {
    const typeName = getCrawlTypeName(type);
    const timeStr = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    let text = `🚀 开始${typeName}抓取\n`;

    const detailParts: string[] = [];
    if (details?.limit) detailParts.push(`🎯 目标 ${details.limit} 张`);
    if (details?.pid) detailParts.push(`🎴 PID ${details.pid}`);
    if (details?.tag) detailParts.push(`🏷️ ${details.tag}`);
    if (details?.r18Enabled) detailParts.push(`🔞 R18`);

    if (detailParts.length > 0) {
        text += detailParts.join(' | ') + `\n`;
    }
    text += `📅 ${timeStr}`;

    return text;
}

/**
 * 生成简化版抓取完成纯文本（用于 Qmsg酱）
 */
function generateSimpleCrawlPlainText(report: SimpleCrawlReport): string {
    const { type, success, failed, skipped, duration, details } = report;
    const typeName = getCrawlTypeName(type);
    const overallStatus = failed > 0 ? (success > 0 ? '⚠️ 部分成功' : '❌ 失败') : '✅ 成功';

    let text = `🖼️ ${typeName}抓取完成 ${overallStatus}\n`;

    if (details?.pid) {
        text += `🎴 PID ${details.pid}\n`;
    }
    if (details?.tag) {
        text += `🏷️ 标签 ${details.tag}\n`;
    }

    text += `✨ +${success} 新增`;
    if (failed > 0) text += ` | ❌ ${failed} 失败`;
    if (skipped > 0) text += ` | ⏭ ${skipped} 跳过`;
    text += ` | ⏱ ${formatDuration(duration)}`;

    return text;
}

/**
 * 生成错误报警纯文本（用于 Qmsg酱）
 */
function generateErrorPlainText(error: string, context?: string): string {
    const timeStr = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    let text = `❌ 抓取异常`;
    if (context) {
        text += ` - ${context}`;
    }
    text += `\n${error}\n📅 ${timeStr}`;

    return text;
}

// ============================================
// 组合推送函数（先 Webhook 后 Qmsg）
// ============================================

/**
 * 发送抓取完成通知（Webhook + Qmsg）
 */
export async function sendCrawlNotificationAll(report: CrawlReport): Promise<boolean> {
    // 先发送企业微信
    const wecomResult = await sendCrawlNotification(report);

    // 再发送 Qmsg酱
    const plainText = generateCrawlReportPlainText(report);
    await sendQmsgMessage(plainText);

    return wecomResult;
}

/**
 * 发送开始抓取通知（Webhook + Qmsg）
 */
export async function sendCrawlStartNotificationAll(
    type: CrawlType,
    details?: { limit?: number; pid?: number; tag?: string; r18Enabled?: boolean }
): Promise<boolean> {
    // 先发送企业微信
    const wecomResult = await sendCrawlStartNotification(type, details);

    // 再发送 Qmsg酱
    const plainText = generateStartPlainText(type, details);
    await sendQmsgMessage(plainText);

    return wecomResult;
}

/**
 * 发送错误报警（Webhook + Qmsg）
 */
export async function sendErrorAlertAll(error: string, context?: string): Promise<boolean> {
    // 先发送企业微信
    const wecomResult = await sendErrorAlert(error, context);

    // 再发送 Qmsg酱
    const plainText = generateErrorPlainText(error, context);
    await sendQmsgMessage(plainText);

    return wecomResult;
}
