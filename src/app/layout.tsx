import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Pixiv-Vercel-Sync | 图片自动同步系统",
    description: "A Pixiv image auto-scraping and distribution system deployed on Vercel",
    icons: {
        icon: [
            { url: "/wzk116.png" },
            { url: "/icon.png", sizes: "32x32", type: "image/png" },
        ],
        apple: "/apple-icon.png",
    },
};

// 从环境变量获取背景图片URL
const BACKGROUND_IMAGE_URL = process.env.NEXT_PUBLIC_BACKGROUND_URL || '';

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" className="dark">
            <body className={`${inter.className} antialiased`}>
                {/* 背景图片层 */}
                {BACKGROUND_IMAGE_URL && (
                    <>
                        <div
                            className="bg-image-layer"
                            style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
                        />
                        <div className="bg-overlay" />
                    </>
                )}

                {/* 主内容 */}
                <div className="relative z-10 min-h-screen">
                    {children}
                </div>
            </body>
        </html>
    );
}
