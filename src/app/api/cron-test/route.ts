/**
 * Cron Test API - 测试自动抓取是否正常工作
 * 访问 /api/cron-test 可以检查配置状态
 */

import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/pixiv';

export async function GET() {
    const checks = {
        timestamp: new Date().toISOString(),
        pixivAuthenticated: isAuthenticated(),
        cronSecret: process.env.CRON_SECRET ? '已配置' : '未配置',
        pixivPhpsessid: process.env.PIXIV_PHPSESSID ? '已配置' : '未配置',
        r2AccessKey: process.env.R2_ACCESS_KEY_ID ? '已配置' : '未配置',
        r2SecretKey: process.env.R2_SECRET_ACCESS_KEY ? '已配置' : '未配置',
        r2Bucket: process.env.R2_BUCKET_NAME || '未配置',
        r2PublicUrl: process.env.R2_PUBLIC_URL || '未配置',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '已配置' : '未配置',
        supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '已配置' : '未配置',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已配置' : '未配置',
    };

    const allConfigured =
        checks.pixivAuthenticated &&
        checks.cronSecret !== '未配置' &&
        checks.pixivPhpsessid !== '未配置' &&
        checks.r2AccessKey !== '未配置' &&
        checks.r2SecretKey !== '未配置' &&
        checks.supabaseUrl !== '未配置' &&
        checks.supabaseServiceRoleKey !== '未配置';

    return NextResponse.json({
        status: allConfigured ? '✅ 所有配置正常' : '❌ 部分配置缺失',
        checks,
    });
}
