/**
 * Webhook 测试 API
 * 用于测试企业微信 Webhook 推送功能
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    sendCrawlNotification,
    sendTextNotification,
    sendErrorAlert,
    isWebhookConfigured,
    type CrawlReport
} from '@/lib/webhook';

export async function GET(request: NextRequest) {
    // 检查是否配置了 Webhook
    if (!isWebhookConfigured()) {
        return NextResponse.json({
            success: false,
            error: '未配置 WECOM_WEBHOOK_URL 环境变量',
            hint: '请在 Vercel 环境变量中添加 WECOM_WEBHOOK_URL'
        }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'text';

    try {
        let result = false;

        switch (type) {
            case 'text':
                // 发送简单文本测试
                result = await sendTextNotification(
                    '🧪 Pixiv 抓取系统 Webhook 测试\n\n这是一条测试消息，如果你看到这条消息，说明 Webhook 配置成功！'
                );
                break;

            case 'report':
                // 发送模拟的抓取报告
                const mockReport: CrawlReport = {
                    stats: {
                        ranking: { success: 8, failed: 1, skipped: 2 },
                        r18: { success: 5, failed: 0, skipped: 1 },
                        tag: { success: 3, failed: 0, skipped: 0 },
                        favorite: { success: 4, failed: 0, skipped: 1 },
                    },
                    totalSuccess: 20,
                    totalFailed: 1,
                    totalSkipped: 4,
                    duration: 45.6,
                    tags: ['風景', '女の子', '原神', 'ブルーアーカイブ'],
                    r18Enabled: true,
                    tagSearchEnabled: true,
                    timestamp: new Date(),
                };
                result = await sendCrawlNotification(mockReport);
                break;

            case 'error':
                // 发送模拟的错误报警
                result = await sendErrorAlert(
                    'PIXIV_PHPSESSID 已过期，无法访问 Pixiv API',
                    'Webhook 测试 - 模拟错误'
                );
                break;

            case 'success':
                // 发送成功的抓取报告（无失败）
                const successReport: CrawlReport = {
                    stats: {
                        ranking: { success: 10, failed: 0, skipped: 3 },
                        r18: { success: 5, failed: 0, skipped: 2 },
                        tag: { success: 0, failed: 0, skipped: 0 },
                        favorite: { success: 6, failed: 0, skipped: 1 },
                    },
                    totalSuccess: 21,
                    totalFailed: 0,
                    totalSkipped: 6,
                    duration: 38.2,
                    tags: ['夜景', 'アズールレーン'],
                    r18Enabled: true,
                    tagSearchEnabled: false,
                    timestamp: new Date(),
                };
                result = await sendCrawlNotification(successReport);
                break;

            default:
                return NextResponse.json({
                    success: false,
                    error: `未知的测试类型: ${type}`,
                    availableTypes: ['text', 'report', 'success', 'error']
                }, { status: 400 });
        }

        return NextResponse.json({
            success: result,
            message: result ? '消息发送成功！请检查企业微信群' : '消息发送失败',
            type,
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
