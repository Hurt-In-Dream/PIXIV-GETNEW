/**
 * Authentication API Route
 * Validates password on server-side, sets HTTP-only cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Environment variable for dashboard password
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

// Token expiry: 7 days
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a simple hash for session token
 */
function generateSessionToken(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
}

/**
 * POST /api/auth - Login
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password } = body;

        // Check if password protection is enabled
        if (!DASHBOARD_PASSWORD) {
            return NextResponse.json({
                success: true,
                message: 'No password required'
            });
        }

        // Validate password
        if (password !== DASHBOARD_PASSWORD) {
            return NextResponse.json(
                { success: false, error: '密码错误' },
                { status: 401 }
            );
        }

        // Generate session token
        const sessionToken = generateSessionToken();
        const expiry = Date.now() + TOKEN_EXPIRY;

        // Set HTTP-only cookie (cannot be accessed by JavaScript)
        const cookieStore = await cookies();
        cookieStore.set('session_token', `${sessionToken}:${expiry}`, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: TOKEN_EXPIRY / 1000,
            path: '/',
        });

        return NextResponse.json({
            success: true,
            message: '登录成功'
        });
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json(
            { success: false, error: '认证失败' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth - Check login status
 */
export async function GET() {
    // If no password is set, always authenticated
    if (!DASHBOARD_PASSWORD) {
        return NextResponse.json({ authenticated: true });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session_token');

    if (!sessionCookie) {
        return NextResponse.json({ authenticated: false });
    }

    // Validate session token
    const [, expiryStr] = sessionCookie.value.split(':');
    const expiry = parseInt(expiryStr, 10);

    if (isNaN(expiry) || Date.now() > expiry) {
        return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true });
}

/**
 * DELETE /api/auth - Logout
 */
export async function DELETE() {
    const cookieStore = await cookies();
    cookieStore.delete('session_token');

    return NextResponse.json({ success: true, message: '已退出登录' });
}
