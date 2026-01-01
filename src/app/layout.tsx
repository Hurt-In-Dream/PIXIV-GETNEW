import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Pixiv-Vercel-Sync | 图片自动同步系统",
    description: "A Pixiv image auto-scraping and distribution system deployed on Vercel",
    icons: {
        icon: "/wzk116.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" className="dark">
            <body className={`${inter.className} antialiased`}>
                {/* Animated background particles */}
                <div className="particles">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="particle"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 15}s`,
                                animationDuration: `${15 + Math.random() * 10}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Main content */}
                <div className="relative z-10 min-h-screen">
                    {children}
                </div>
            </body>
        </html>
    );
}
