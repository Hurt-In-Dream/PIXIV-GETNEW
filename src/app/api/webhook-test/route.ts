/**
 * Webhook 测试 API
 * 用于测试企业微信 Webhook 和 Qmsg酱 推送功能
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    sendCrawlNotification,
    sendTextNotification,
    sendErrorAlert,
    sendMessageWithDebug,
    isWebhookConfigured,
    isQmsgConfigured,
    sendQmsgMessage,
    sendQmsgWithDebug,
    type CrawlReport,
    type QmsgResult
} from '@/lib/webhook';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'debug';

    try {
        switch (type) {
            case 'debug':
                // 发送调试消息并返回详细信息（同时测试 Webhook 和 Qmsg）
                const wecomConfigured = isWebhookConfigured();
                const qmsgConfigured = isQmsgConfigured();

                let wecomResult = null;
                let qmsgResult: QmsgResult | null = null;

                // 测试企业微信
                if (wecomConfigured) {
                    wecomResult = await sendMessageWithDebug({
                        msgtype: 'text',
                        text: {
                            content: '🧪 Pixiv 抓取系统 Webhook 测试\n\n这是一条测试消息，如果你看到这条消息，说明 Webhook 配置成功！\n\n时间: ' + new Date().toISOString()
                        }
                    });
                }

                // 测试 Qmsg酱
                if (qmsgConfigured) {
                    const testMsg = '🧪 Pixiv 抓取系统 Qmsg酱 测试\n\n这是一条测试消息，如果你看到这条消息，说明 Qmsg酱 配置成功！\n\n时间: ' + new Date().toISOString();
                    qmsgResult = await sendQmsgWithDebug(testMsg);
                }

                return NextResponse.json({
                    testType: 'debug',
                    config: {
                        wecomConfigured,
                        qmsgConfigured,
                    },
                    webhook: wecomConfigured ? {
                        ...wecomResult,
                        message: wecomResult?.success
                            ? '✅ 企业微信消息发送成功！'
                            : '❌ 企业微信消息发送失败',
                    } : { message: '⚠️ 未配置 WECOM_WEBHOOK_URL' },
                    qmsg: qmsgConfigured ? {
                        ...qmsgResult,
                        message: qmsgResult?.success
                            ? '✅ Qmsg酱消息发送成功！'
                            : '❌ Qmsg酱消息发送失败',
                    } : { message: '⚠️ 未配置 QMSG_KEY' },
                    timestamp: new Date().toISOString(),
                });

            case 'qmsg':
                // 单独测试 Qmsg酱
                if (!isQmsgConfigured()) {
                    return NextResponse.json({
                        success: false,
                        error: '未配置 QMSG_KEY 环境变量',
                        hint: '请在 Vercel 环境变量中添加 QMSG_KEY',
                    }, { status: 400 });
                }

                const qmsgTestResult = await sendQmsgWithDebug(
                    '🧪 Pixiv 抓取系统测试\n\n这是一条 Qmsg酱 测试消息！\n如果你看到这条消息，说明配置成功！\n\n时间: ' + new Date().toISOString()
                );

                return NextResponse.json({
                    testType: 'qmsg',
                    ...qmsgTestResult,
                    message: qmsgTestResult.success
                        ? '✅ Qmsg酱消息发送成功！请检查 QQ 私聊'
                        : '❌ Qmsg酱消息发送失败',
                });

            case 'text':
                // 发送简单文本测试
                if (!isWebhookConfigured()) {
                    return NextResponse.json({
                        success: false,
                        error: '未配置 WECOM_WEBHOOK_URL 环境变量',
                    }, { status: 400 });
                }
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

                // 先发送企业微信
                const reportSuccess = await sendCrawlNotification(mockReport);

                // 再发送 Qmsg酱（如果配置了）
                let qmsgReportResult: QmsgResult | null = null;
                if (isQmsgConfigured()) {
                    const reportText = `🖼️ Pixiv 自动抓取报告（测试）
✅ 成功

✨ 新增 20 张 | 跳过 4
⏱ 耗时 45.6秒

📊排行榜: 8 | 🔞R18: 5 | 🏷️标签: 3 | 🧠智能: 4

🏷️ 風景 女の子 原神 ブルーアーカイブ`;
                    qmsgReportResult = await sendQmsgMessage(reportText);
                }

                return NextResponse.json({
                    success: reportSuccess || (qmsgReportResult?.success ?? false),
                    webhook: { success: reportSuccess },
                    qmsg: qmsgReportResult || { message: '未配置 QMSG_KEY' },
                    message: '报告发送完成！',
                    type,
                });

            case 'error':
                // 发送模拟的错误报警
                const errorSuccess = await sendErrorAlert(
                    'PIXIV_PHPSESSID 已过期，无法访问 Pixiv API',
                    'Webhook 测试 - 模拟错误'
                );

                // 再发送 Qmsg酱（如果配置了）
                let qmsgErrorResult: QmsgResult | null = null;
                if (isQmsgConfigured()) {
                    const errorText = `❌ 抓取异常 - Webhook 测试
PIXIV_PHPSESSID 已过期，无法访问 Pixiv API
📅 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
                    qmsgErrorResult = await sendQmsgMessage(errorText);
                }

                return NextResponse.json({
                    success: errorSuccess || (qmsgErrorResult?.success ?? false),
                    webhook: { success: errorSuccess },
                    qmsg: qmsgErrorResult || { message: '未配置 QMSG_KEY' },
                    message: '错误报警发送完成！',
                    type,
                });

            default:
                return NextResponse.json({
                    success: false,
                    error: `未知的测试类型: ${type}`,
                    availableTypes: ['debug', 'qmsg', 'text', 'report', 'error'],
                    hint: '推荐使用 ?type=debug 同时测试所有配置的推送渠道',
                    config: {
                        wecomConfigured: isWebhookConfigured(),
                        qmsgConfigured: isQmsgConfigured(),
                    }
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
