# 部署教程

本项目支持一键部署到 Vercel，并结合 Supabase 和 Cloudflare R2 实现全栈功能。

## 1. 准备工作

在开始之前，请确保你已经获取了 [环境变量指南](./env-vars.md) 中提到的所有 Key。

## 2. 数据库初始化

1. 登录 [Supabase](https://supabase.com/)
2. 进入你的项目，点击左侧的 **SQL Editor**
3. 点击 "New query"
4. 将本项目 `supabase/schema.sql` 文件内容全部复制进去
5. 点击 **Run** 执行

这将创建以下表：

| 表名 | 用途 |
|------|------|
| `pixiv_images` | 存储图片元数据 (PID, 标题, 作者, 标签, R2 链接) |
| `crawler_settings` | 存储爬虫设置 (Cron, 抓取数量, R18 开关, 标签搜索设置) |
| `crawler_logs` | 存储活动日志 (级别, 消息, 详情, 时间) |
| `skip_tags` | 存储自定义过滤标签 (标签, 翻译, 分类) |

## 3. 部署到 Vercel

### 方式 A：GitHub 自动部署 (推荐)

1. Fork 或上传本项目到你的 GitHub 仓库
2. 在 [Vercel](https://vercel.com/) 点击 "Add New" -> "Project"
3. 导入你的 GitHub 仓库
4. 在 **Environment Variables** 部分，依次添加所有环境变量
5. 点击 **Deploy**

### 方式 B：Vercel CLI 命令行部署

```bash
npm i -g vercel
vercel
```

按提示完成配置即可。

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

默认设置为每天凌晨 0 点 (UTC) 执行。

### 常用 Cron 表达式

| 表达式 | 含义 |
|--------|------|
| `0 0 * * *` | 每天 0:00 UTC |
| `0 */6 * * *` | 每 6 小时 |
| `0 8 * * *` | 每天 8:00 UTC |
| `0 0,12 * * *` | 每天 0:00 和 12:00 |

### 验证 Cron 配置

1. 部署完成后，进入 Vercel 项目面板
2. 点击 **Settings** -> **Cron Jobs**
3. 你应该能看到 `/api/cron` 已经列在其中
4. 确保你已经在环境变量中配置了 `CRON_SECRET`

## 5. 数据库迁移 (已有部署更新)

如果你是从旧版本更新，需要运行以下 SQL 添加新字段：

```sql
-- 添加抓取数量设置
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS crawl_limit INTEGER DEFAULT 10;
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS r18_crawl_limit INTEGER DEFAULT 10;

-- 添加标签搜索设置
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS tag_search_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS tag_search_limit INTEGER DEFAULT 10;

-- 创建过滤标签表
CREATE TABLE IF NOT EXISTS skip_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  translation TEXT,
  category TEXT DEFAULT 'other',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加热度筛选设置 (v1.4+)
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS popularity_filter_auto BOOLEAN DEFAULT FALSE;
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS popularity_filter_manual BOOLEAN DEFAULT FALSE;
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS popularity_filter_pid BOOLEAN DEFAULT TRUE;
```

## 6. 验证部署

1. 访问你的 Vercel 部署域名
2. 检查页面是否正常加载
3. 尝试点击 "手动抓取"
4. 观察 "活动日志" 是否有输出
5. 如果出现 401 错误，请检查 `PIXIV_PHPSESSID` 是否正确

## 7. 常见部署问题

### 构建失败
- 检查 Node.js 版本 (需要 18+)
- 确保所有依赖都已正确安装

### API 请求超时
- Vercel 免费版函数超时限制为 10 秒
- 建议升级到 Pro 版 (60 秒超时)
- 或减少每次抓取数量

### R2 上传失败
- 检查 R2 API Token 权限是否包含 "Edit"
- 确认 Bucket 名称正确
- 验证 Account ID 无误
