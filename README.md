# Pixiv-Vercel-Sync

🎨 **一个部署在 Vercel 上的 Pixiv 图片自动抓取、智能筛选与 R2 分发系统。**

本项目旨在打造一个自动化的高质量二次元背景图库，支持自动抓取 Pixiv 排行榜、智能过滤非背景类图片、自动平衡横竖屏比例，并转存至 Cloudflare R2。

![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)
![Cloudflare](https://img.shields.io/badge/Cloudflare-R2-orange?style=flat-square&logo=cloudflare)

---

## ✨ 核心功能

- 🤖 **全自动运行**: 通过 Vercel Cron 定时触发，无需人工干预。
- 🧠 **智能筛选**: 
  - **背景优化**: 自动过滤透明背景、纯色背景、草稿、设定图。
  - **内容精选**: 自动跳过漫画、连载、AI 生成的作品。
  - **比例平衡**: 自动维持横屏 (h) 与竖屏 (v) 图片 1:1 的存储比例。
- 🚀 **多样化抓取**: 支持排行榜抓取、指定标签搜索抓取、特定 PID 及其相关推荐抓取。
- ☁️ **R2 分类存储**: 按分级 (R18) 和屏幕方向 (横/竖) 自动组织文件夹结构。
- 📊 **精美面板**: 基于 Next.js 构建的二次元风格管理后台，实时查看抓取日志。

---

## 📖 文档指南

为了方便使用，我们将详细指南分成了以下几个部分：

1.  **[环境变量获取](./docs/env-vars.md)** - *第一步：获取 Supabase、R2 和 Pixiv 的所有密钥*
2.  **[部署教程](./docs/deployment.md)** - *第二步：初始化数据库并部署到 Vercel*
3.  **[使用手册](./docs/usage.md)** - *第三步：了解如何使用管理面板和系统逻辑*

---

## 📦 技术栈

- **前端**: Next.js 14 (App Router), Tailwind CSS, Lucide Icons
- **后端**: Next.js API Routes (Edge/Serverless)
- **数据库**: Supabase (PostgreSQL)
- **存储**: Cloudflare R2 (S3 兼容)
- **爬虫**: Axios + Pixiv AJAX API

---

## 📁 项目结构

```
pixiv-vercel-sync/
├── docs/               # 详细文档
├── src/
│   ├── app/            # 页面与 API 路由
│   ├── components/     # UI 组件
│   └── lib/            # 核心逻辑 (Pixiv, R2, 数据库)
├── supabase/           # 数据库脚本
├── vercel.json         # Vercel 配置 (Cron)
└── README.md
```

---

## ⚠️ 免责声明

1.  本项目仅供学习研究使用，请勿用于商业用途。
2.  图片版权归原作者所有，请尊重画师劳动成果。
3.  请遵守 Pixiv 服务条款，合理控制抓取频率。

---

Made with ❤️ for anime lovers.
