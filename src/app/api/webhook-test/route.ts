/**
 * Webhook 测试 API
 * 用于测试企业微信 Webhook 推送功能
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    sendCrawlNotification,
    sendTextNotification,
    sendErrorAlert,
    sendMessageWithDebug,
    isWebhookConfigured,
    type CrawlReport
} from '@/lib/webhook';

export async function GET(request: NextRequest) {
    // 检查是否配置了 Webhook
    if (!isWebhookConfigured()) {
        return NextResponse.json({
            success: false,
            error: '未配置 WECOM_WEBHOOK_URL 环境变量',
            hint: '请在 Vercel 环境变量中添加 WECOM_WEBHOOK_URL',
            envCheck: {
                WECOM_WEBHOOK_URL: !!process.env.WECOM_WEBHOOK_URL,
            }
        }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'debug';

    try {
        switch (type) {
            case 'debug':
                // 发送调试消息并返回详细信息
                const debugResult = await sendMessageWithDebug({
                    msgtype: 'text',
                    text: {
                        content: '🧪 Pixiv 抓取系统 Webhook 测试\n\n这是一条测试消息，如果你看到这条消息，说明 Webhook 配置成功！\n\n时间: ' + new Date().toISOString()
                    }
                });

                return NextResponse.json({
                    testType: 'debug',
                    ...debugResult,
                    message: debugResult.success
                        ? '✅ 消息发送成功！请检查企业微信群'
                        : '❌ 消息发送失败，请检查上方错误信息',
                    timestamp: new Date().toISOString(),
                });

            case 'text':
                // 发送简单文本测试
                const textSuccess = await sendTextNotification(
                    '🧪 Pixiv 抓取系统 Webhook 测试\n\n这是一条测试消息，如果你看到这条消息，说明 Webhook 配置成功！'
                );
                return NextResponse.json({
                    success: textSuccess,
                    message: textSuccess ? '消息发送成功！' : '消息发送失败',
                    type,
                });

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
                const reportSuccess = await sendCrawlNotification(mockReport);
                return NextResponse.json({
                    success: reportSuccess,
                    message: reportSuccess ? '报告发送成功！' : '报告发送失败',
                    type,
                });

            case 'error':
                // 发送模拟的错误报警
                const errorSuccess = await sendErrorAlert(
                    'PIXIV_PHPSESSID 已过期，无法访问 Pixiv API',
                    'Webhook 测试 - 模拟错误'
                );
                return NextResponse.json({
                    success: errorSuccess,
                    message: errorSuccess ? '错误报警发送成功！' : '错误报警发送失败',
                    type,
                });

            default:
                return NextResponse.json({
                    success: false,
                    error: `未知的测试类型: ${type}`,
                    availableTypes: ['debug', 'text', 'report', 'error'],
                    hint: '推荐使用 ?type=debug 查看详细调试信息'
                }, { status: 400 });
        }

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        }, { status: 500 });
    }
}
