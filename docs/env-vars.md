# 环境变量获取指南

本项目需要配置多个第三方服务的环境变量才能正常运行。以下是详细的获取步骤。

## 环境变量清单

```env
# Supabase 数据库
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Cloudflare R2 存储
R2_ACCOUNT_ID=你的Account ID
R2_ACCESS_KEY_ID=你的Access Key
R2_SECRET_ACCESS_KEY=你的Secret Key
R2_BUCKET_NAME=pixiv-images
R2_PUBLIC_URL=https://your-domain.com 或 https://pub-xxx.r2.dev

# Pixiv 登录凭证
PIXIV_PHPSESSID=你的PHPSESSID

# 定时任务安全 (可选但推荐)
CRON_SECRET=一串随机字符

# 控制台访问密码 (可选，留空则无需密码)
DASHBOARD_PASSWORD=你的访问密码
```

---

## 1. Supabase (数据库)

前往 [Supabase 官网](https://supabase.com/) 注册并创建一个新项目。

### NEXT_PUBLIC_SUPABASE_URL
- 进入项目设置 (Settings) -> API
- 在 "Project Config" 下找到 `Project URL`

### NEXT_PUBLIC_SUPABASE_ANON_KEY
- 进入项目设置 (Settings) -> API
- 在 "Project API keys" 下找到 `anon` `public` 对应的 Key

### SUPABASE_SERVICE_ROLE_KEY
- 进入项目设置 (Settings) -> API
- 在 "Project API keys" 下找到 `service_role` `secret` 对应的 Key
- **⚠️ 安全提醒**: 此 Key 具有最高权限，请勿泄露

---

## 2. Cloudflare R2 (对象存储)

登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。

### R2_ACCOUNT_ID
- 在 Cloudflare 首页右侧或 R2 概览页面可以找到 `Account ID`

### R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY
1. 进入 R2 页面，点击右侧的 "Manage R2 API Tokens"
2. 点击 "Create API token"
3. 权限选择 "Edit"
4. 存储桶选择你创建的桶或 "All buckets"
5. 创建后会显示 `Access Key ID` 和 `Secret Access Key`
6. **⚠️ 重要**: 立即保存 Secret，之后无法再次查看

### R2_BUCKET_NAME
- 你在 R2 中创建的存储桶 (Bucket) 的名称

### R2_PUBLIC_URL
进入你的存储桶设置 (Settings):

**方式 A: r2.dev 公共域名 (快速但较慢)**
- 在 "Public Access" 下开启 `r2.dev` 临时子域名
- 格式: `https://pub-xxx.r2.dev`

**方式 B: 自定义域名 (推荐，更快)**
1. 点击 "Connect Domain"
2. 输入子域名 (如 `img.yourdomain.com`)
3. 等待 DNS 生效
4. 格式: `https://img.yourdomain.com`

---

## 3. Pixiv (数据源)

你需要一个已登录的 Pixiv 账号来获取 Cookie。

### PIXIV_PHPSESSID

1. 在电脑浏览器打开 [Pixiv](https://www.pixiv.net) 并登录
2. 按 `F12` 打开开发者工具
3. 切换到 **Application** (应用程序) 选项卡
4. 在左侧菜单找到 **Cookies** -> `https://www.pixiv.net`
5. 找到 `PHPSESSID`，复制它的 `Value`

**⚠️ 注意事项**:
- 如果退出 Pixiv 登录，Cookie 会立即失效
- Cookie 可能会定期过期，需要重新获取
- 建议使用专门的账号，避免影响日常浏览

---

## 4. Vercel Cron (定时任务安全)

### CRON_SECRET
- 用于确保只有 Vercel 的定时任务可以触发 `/api/cron` 接口
- 可以自定义任意随机字符串 (建议 32 位以上)
- 示例: `my-super-secret-cron-token-12345`

部署后，Vercel 会自动在 Cron 请求头中带上:
```
Authorization: Bearer <YOUR_CRON_SECRET>
```

---

## 5. 控制台访问密码 (可选)

### DASHBOARD_PASSWORD
- 用于保护管理面板，防止未授权访问
- **可选配置**: 如果不设置此变量，则无需密码即可访问
- 密码在服务端验证，无法通过前端破解
- 登录后会设置 HTTP-only Cookie，有效期 7 天

**工作原理:**
1. 用户访问网站时，会检查是否已登录
2. 未登录时显示密码输入页面
3. 密码在服务端验证，正确后设置加密 Cookie
4. Cookie 为 HTTP-only，JavaScript 无法读取，安全性高

**示例:**
```
DASHBOARD_PASSWORD=MySecretPassword123
```

---

## 6. 配置到 Vercel

1. 登录 [Vercel](https://vercel.com/)
2. 进入你的项目 -> Settings -> Environment Variables
3. 逐个添加上述环境变量
4. 点击 Save
5. **重新部署** 项目以使变量生效

> 💡 提示: 可以先在本地创建 `.env` 文件测试，然后再同步到 Vercel。

