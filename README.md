# Pixiv-Vercel-Sync

🎨 一个部署在 Vercel 上的 Pixiv 图片自动抓取与分发系统。

![Next.js](https://img.shields.io/badge/Next.js-14+-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)
![Cloudflare](https://img.shields.io/badge/Cloudflare-R2-orange?style=flat-square&logo=cloudflare)

## ✨ 功能特性

- 🤖 **自动抓取**: 通过 Vercel Cron 定时抓取 Pixiv 每日热门图片
- 🔍 **PID 抓取**: 手动输入 PID 抓取指定作品及其相关推荐
- 🏷️ **标签搜索**: 根据自定义标签抓取热门作品
- ☁️ **R2 存储**: 图片自动转存至 Cloudflare R2，生成公开链接
- 📊 **管理面板**: 精美的二次元风格 Web 管理界面
- ⚡ **批处理**: 智能分批处理，避免 Serverless 超时

## 📦 技术栈

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Cloudflare R2 (S3 兼容)
- **UI**: Tailwind CSS + Lucide Icons
- **HTTP**: Axios (处理 Pixiv 防盗链)

## 🚀 部署指南

### 1. 克隆项目

```bash
git clone https://github.com/your-username/pixiv-vercel-sync.git
cd pixiv-vercel-sync
npm install
```

### 2. 配置 Supabase

1. 前往 [Supabase](https://supabase.com) 创建新项目
2. 在 SQL Editor 中运行 `supabase/schema.sql` 创建数据表
3. 复制项目的 URL 和 Keys

### 3. 配置 Cloudflare R2

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 创建 R2 Bucket 并开启公开访问
3. 在 R2 > Manage R2 API Tokens 创建 API Token
4. 记录 Account ID、Access Key ID、Secret Access Key

### 4. 获取 Pixiv PHPSESSID

1. 在浏览器登录 [Pixiv](https://www.pixiv.net)
2. 打开开发者工具 (F12) > Application > Cookies
3. 找到 `PHPSESSID` 并复制其值

### 5. 配置环境变量

创建 `.env.local` 文件（参考 `.env.example`）：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=pixiv-images
R2_PUBLIC_URL=https://xxx.r2.dev

# Pixiv
PIXIV_PHPSESSID=xxx_xxx

# Cron (用于验证 Vercel Cron 请求)
CRON_SECRET=your-random-secret
```

### 6. 部署到 Vercel

```bash
npm i -g vercel
vercel
```

或直接通过 Vercel Dashboard 连接 GitHub 仓库。

### 7. 配置 Vercel Cron

在 Vercel Dashboard:
1. 进入项目 Settings > Cron Jobs
2. 确认 `/api/cron` 路由已配置
3. 添加 `CRON_SECRET` 环境变量

> ⚠️ **注意**: Vercel Hobby 计划 Cron 最短间隔为每天一次。Pro 计划支持更频繁的调度。

## 📁 项目结构

```
pixiv-vercel-sync/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cron/       # Cron 触发接口
│   │   │   ├── crawl/      # 手动抓取接口
│   │   │   ├── fetch-pid/  # PID 抓取接口
│   │   │   ├── images/     # 图片列表接口
│   │   │   └── settings/   # 设置接口
│   │   ├── page.tsx        # 管理面板
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── dashboard/      # 面板组件
│   └── lib/
│       ├── pixiv/          # Pixiv 爬虫模块
│       ├── supabase.ts     # 数据库客户端
│       ├── r2.ts           # R2 存储客户端
│       ├── transfer.ts     # 图片转存逻辑
│       └── utils.ts
├── supabase/
│   └── schema.sql          # 数据库建表语句
├── vercel.json             # Cron 配置
└── README.md
```

## 🔧 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 服务端 Key |
| `R2_ACCOUNT_ID` | ✅ | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | ✅ | R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 Secret Access Key |
| `R2_BUCKET_NAME` | ✅ | R2 Bucket 名称 |
| `R2_PUBLIC_URL` | ✅ | R2 公开访问 URL |
| `PIXIV_PHPSESSID` | ✅ | Pixiv 登录 Cookie |
| `CRON_SECRET` | ⚠️ | Cron 验证密钥 (推荐) |

## 📝 使用说明

### 管理面板

访问部署后的 URL，即可看到管理面板：

- **设置面板**: 配置 Cron 表达式、目标标签、R-18 开关
- **手动抓取**: 立即从排行榜抓取图片
- **PID 抓取**: 输入作品 ID 抓取指定图片
- **图库**: 浏览已抓取的图片，复制 R2 链接

### API 接口

- `GET /api/cron` - Cron 自动抓取 (需 Bearer Token)
- `POST /api/crawl` - 手动触发抓取
- `POST /api/fetch-pid` - PID 抓取
- `GET /api/images` - 获取图片列表
- `GET/POST /api/settings` - 设置管理

## ⚠️ 注意事项

1. **Pixiv Cookie 有效期**: PHPSESSID 可能会过期，需要定期更新
2. **Vercel 超时**: Serverless 函数有执行时间限制，系统已设计批处理逻辑
3. **R2 流量**: 注意 R2 的免费额度限制
4. **合规使用**: 请遵守 Pixiv 服务条款，仅用于个人学习研究

## 📄 License

MIT License

---

Made with ❤️ for anime lovers
