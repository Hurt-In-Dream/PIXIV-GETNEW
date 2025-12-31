# Vercel Cron 定时任务配置教程

本教程将指导你如何在 Vercel 上配置 Cron 定时任务，实现自动抓取 Pixiv 图片。

---

## 📋 目录

1. [什么是 CRON_SECRET](#1-什么是-cron_secret)
2. [生成 CRON_SECRET](#2-生成-cron_secret)
3. [在 Vercel 配置环境变量](#3-在-vercel-配置环境变量)
4. [Cron 任务工作原理](#4-cron-任务工作原理)
5. [修改定时频率](#5-修改定时频率)
6. [验证配置](#6-验证配置)

---

## 1. 什么是 CRON_SECRET

`CRON_SECRET` 是一个安全密钥，用于验证 Cron 请求是否来自 Vercel 官方。

**为什么需要它？**
- 防止恶意用户直接访问 `/api/cron` 接口触发抓取
- 只有 Vercel 的 Cron 系统知道这个密钥
- 确保定时任务只在预定时间执行

---

## 2. 生成 CRON_SECRET

你需要生成一个随机的安全字符串。有几种方法：

### 方法 A：使用在线生成器
访问 https://generate-secret.vercel.app/32 会自动生成一个 32 位随机字符串。

### 方法 B：使用 Node.js
在终端运行：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 方法 C：使用 PowerShell
```powershell
-join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

### 方法 D：手动创建
创建一个至少 32 个字符的随机字符串，例如：
```
my_super_secret_cron_key_2026_pixiv_sync
```

> ⚠️ **重要**: 不要使用简单的密码，也不要在代码中硬编码这个值！

---

## 3. 在 Vercel 配置环境变量

### 步骤 1: 部署项目到 Vercel

1. 将代码推送到 GitHub
2. 访问 [vercel.com](https://vercel.com) 并登录
3. 点击 "Add New Project"
4. 选择你的 GitHub 仓库
5. 点击 "Deploy"

### 步骤 2: 配置环境变量

1. 在 Vercel Dashboard 中，进入你的项目
2. 点击顶部的 **Settings** 标签
3. 在左侧菜单选择 **Environment Variables**
4. 添加以下变量：

| Key | Value | Environment |
|-----|-------|-------------|
| `CRON_SECRET` | 你生成的密钥 | Production, Preview, Development |

5. 点击 **Save**

### 步骤 3: 添加其他必要的环境变量

同样方式添加：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`
- `PIXIV_PHPSESSID`

---

## 4. Cron 任务工作原理

### 配置文件位置

Cron 任务在 `vercel.json` 中配置：

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

### 工作流程

```
Vercel Cron 系统
       ↓
在预定时间触发
       ↓
发送 GET 请求到 /api/cron
(请求头包含 Authorization: Bearer <CRON_SECRET>)
       ↓
API 验证密钥
       ↓
执行抓取任务
```

### Vercel 如何传递密钥

当你在 Vercel 设置了 `CRON_SECRET` 环境变量后，Vercel 会自动在 Cron 请求中添加：
```
Authorization: Bearer <你的CRON_SECRET值>
```

我们的 `/api/cron` 路由会验证这个值：
```typescript
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## 5. 修改定时频率

### Cron 表达式格式

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 6, 0 = 周日)
│ │ │ │ │
* * * * *
```

### 常用示例

| 表达式 | 含义 |
|--------|------|
| `0 0 * * *` | 每天 UTC 0:00 (北京时间 8:00) |
| `0 8 * * *` | 每天 UTC 8:00 (北京时间 16:00) |
| `0 16 * * *` | 每天 UTC 16:00 (北京时间 0:00) |
| `0 */6 * * *` | 每 6 小时 |
| `0 0 * * 0` | 每周日 UTC 0:00 |
| `0 0 1 * *` | 每月 1 日 UTC 0:00 |

### 修改方法

编辑 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 16 * * *"
    }
  ]
}
```

> ⚠️ **Vercel 免费版限制**: Hobby 计划最短间隔为每天一次。Pro 计划支持每小时多次。

---

## 6. 验证配置

### 部署后检查

1. 在 Vercel Dashboard 中，进入项目
2. 点击顶部的 **Settings** 标签
3. 在左侧菜单选择 **Cron Jobs**
4. 你应该能看到配置的 Cron 任务

![Cron Jobs 页面示意](示意图：显示 /api/cron 和 schedule)

### 手动测试 Cron 端点

你可以使用 curl 测试（替换为你的实际值）：

```bash
curl -X GET "https://你的域名.vercel.app/api/cron" \
  -H "Authorization: Bearer 你的CRON_SECRET"
```

成功响应示例：
```json
{
  "success": true,
  "ranking": { "total": 5, "success": 3, "skipped": 2 },
  "tag": { "tag": "イラスト", "total": 5, "success": 2 },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

### 查看执行日志

1. 在 Vercel Dashboard 中，进入项目
2. 点击顶部的 **Logs** 标签
3. 筛选 Function 为 `/api/cron`
4. 查看执行记录和输出

---

## ❓ 常见问题

### Q: 为什么 Cron 没有执行？
A: 检查以下几点：
- 项目是否已部署成功
- `vercel.json` 配置是否正确
- 环境变量是否设置
- 查看 Logs 是否有错误

### Q: 可以在本地测试 Cron 吗？
A: 可以！启动开发服务器后，直接访问：
```
http://localhost:3000/api/cron
```
因为本地没有设置 `CRON_SECRET`，所以不会验证密钥。

### Q: 时区怎么计算？
A: Vercel Cron 使用 **UTC 时区**。
- 北京时间 = UTC + 8 小时
- 如果要在北京时间 8:00 执行，应设置 UTC 0:00，即 `0 0 * * *`

---

## 🎉 完成！

配置完成后，你的 Pixiv 爬虫会按照设定的时间自动运行，无需任何手动操作！
