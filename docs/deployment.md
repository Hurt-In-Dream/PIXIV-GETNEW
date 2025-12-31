# 部署教程

本项目支持一键部署到 Vercel，并结合 Supabase 和 Cloudflare R2 实现全栈功能。

## 1. 准备工作

在开始之前，请确保你已经获取了 [环境变量指南](./env-vars.md) 中提到的所有 Key。

## 2. 数据库初始化

1. 登录 [Supabase](https://supabase.com/)。
2. 进入你的项目，点击左侧的 **SQL Editor**。
3. 点击 "New query"，将本项目根目录下的 `supabase/schema.sql` 文件内容全部复制进去。
4. 点击 **Run** 执行。这将创建 `pixiv_images` (图片表), `crawler_settings` (设置表) 和 `crawler_logs` (日志表)。

## 3. 部署到 Vercel

### 方式 A：GitHub 自动部署 (推荐)

1. 将本项目上传到你的 GitHub 仓库。
2. 在 [Vercel](https://vercel.com/) 点击 "Add New" -> "Project"。
3. 导入你的 GitHub 仓库。
4. 在 **Environment Variables** 部分，依次添加所有环境变量。
5. 点击 **Deploy**。

### 方式 B：Vercel CLI 命令行部署

```bash
npm i -g vercel
vercel
```

## 4. 配置定时任务 (Vercel Cron)

项目根目录下的 `vercel.json` 已经配置了定时任务规则：

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 0 * * *"
    }
  ]
}
```

默认设置为每天凌晨 0 点执行。

1. 部署完成后，进入 Vercel 项目面板。
2. 点击 **Settings** -> **Cron Jobs**。
3. 你应该能看到 `/api/cron` 已经列在其中。
4. 确保你已经在环境变量中配置了 `CRON_SECRET`。

## 5. 验证部署

1. 访问你的 Vercel 部署域名。
2. 进入管理面板，尝试点击 "手动抓取"。
3. 观察 "活动日志" 是否有输出。
4. 如果出现 401 错误，请检查 `PIXIV_PHPSESSID` 是否正确且未过期。
