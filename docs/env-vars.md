# 环境变量获取指南

本项目需要配置多个第三方服务的环境变量才能正常运行。以下是详细的获取步骤。

## 环境变量清单

```env
# Supabase 数据库 (必需)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Cloudflare R2 存储 (必需)
R2_ACCOUNT_ID=你的Account ID
R2_ACCESS_KEY_ID=你的Access Key
R2_SECRET_ACCESS_KEY=你的Secret Key
R2_BUCKET_NAME=pixiv-images
R2_PUBLIC_URL=https://your-domain.com 或 https://pub-xxx.r2.dev

# Pixiv 登录凭证 (必需)
PIXIV_PHPSESSID=你的PHPSESSID

# 定时任务安全 (可选但推荐)
CRON_SECRET=一串随机字符

# 控制台访问密码 (可选，留空则无需密码)
DASHBOARD_PASSWORD=你的访问密码

# GitHub 同步 (可选，用于上传图片到 GitHub 仓库)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

---

## 1. Supabase (数据库)

前往 [Supabase 官网](https://supabase.com/) 注册并创建一个新项目。

### 创建项目步骤
1. 注册/登录 Supabase
2. 点击 **New Project**
3. 选择组织，填写项目名称
4. 设置数据库密码（请牢记）
5. 选择离你最近的区域
6. 点击 **Create new project**
7. 等待项目创建完成（约2分钟）

### NEXT_PUBLIC_SUPABASE_URL
- 进入项目设置 (Settings) -> API
- 在 "Project Config" 下找到 `Project URL`
- 格式: `https://xxxxxxxxxx.supabase.co`

### NEXT_PUBLIC_SUPABASE_ANON_KEY
- 进入项目设置 (Settings) -> API
- 在 "Project API keys" 下找到 `anon` `public` 对应的 Key
- 这是公开的匿名访问 Key

### SUPABASE_SERVICE_ROLE_KEY
- 进入项目设置 (Settings) -> API
- 在 "Project API keys" 下找到 `service_role` `secret` 对应的 Key
- **⚠️ 安全提醒**: 此 Key 具有最高权限，请勿泄露，不要在前端代码中使用

### 初始化数据库
项目创建后，需要运行 SQL 初始化数据库：
1. 在 Supabase 控制台点击 **SQL Editor**
2. 点击 **New query**
3. 复制 `supabase/schema.sql` 文件内容
4. 点击 **Run** 执行

---

## 2. Cloudflare R2 (对象存储)

登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。

### 创建 R2 存储桶
1. 在左侧菜单选择 **R2**
2. 点击 **Create bucket**
3. 输入存储桶名称（如 `pixiv-images`）
4. 选择区域（推荐 Asia Pacific）
5. 点击 **Create bucket**

### R2_ACCOUNT_ID
- 在 Cloudflare 首页右侧可以找到 `Account ID`
- 或进入 R2 概览页面，在 URL 中可以看到
- 格式: 32位十六进制字符串

### R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY
1. 进入 R2 页面，点击右侧的 **Manage R2 API Tokens**
2. 点击 **Create API token**
3. 填写 Token 名称（如 `pixiv-sync`）
4. 权限选择 **Object Read & Write**
5. 存储桶选择你创建的桶或 **Apply to all buckets**
6. 点击 **Create API Token**
7. 页面会显示 `Access Key ID` 和 `Secret Access Key`
8. **⚠️ 重要**: 立即复制保存 Secret，离开页面后无法再次查看！

### R2_BUCKET_NAME
- 你在 R2 中创建的存储桶 (Bucket) 的名称
- 示例: `pixiv-images`

### R2_PUBLIC_URL
进入你的存储桶 -> Settings -> Public Access:

**方式 A: r2.dev 公共域名 (快速设置)**
1. 在 "Public Access" 下点击 **Allow Access**
2. 确认开启公共访问
3. 复制生成的 URL，格式: `https://pub-xxx.r2.dev`
4. ⚠️ 注意: r2.dev 域名速度较慢，可能被部分地区限制

**方式 B: 自定义域名 (推荐，更快更稳定)**
1. 点击 **Connect Domain**
2. 输入你的子域名（如 `img.yourdomain.com`）
3. Cloudflare 会自动配置 DNS
4. 等待 DNS 生效（通常几分钟）
5. 格式: `https://img.yourdomain.com`

---

## 3. Pixiv (数据源)

你需要一个已登录的 Pixiv 账号来获取 Cookie。

### PIXIV_PHPSESSID

**获取步骤:**
1. 在电脑浏览器打开 [Pixiv](https://www.pixiv.net) 并登录
2. 按 `F12` 打开开发者工具
3. 切换到 **Application** (应用程序) 选项卡
   - Chrome/Edge: Application
   - Firefox: Storage (存储)
4. 在左侧菜单找到 **Cookies** -> `https://www.pixiv.net`
5. 在右侧列表找到 `PHPSESSID`
6. 双击 `Value` 列复制值

**Cookie 格式示例:**
```
PHPSESSID=12345678_abcdefghijklmnopqrstuvwxyz
```

**⚠️ 注意事项:**
- 如果退出 Pixiv 登录，Cookie 会立即失效
- Cookie 可能会定期过期（通常几周到几个月），需要重新获取
- 建议使用专门的小号，避免影响日常浏览
- 抓取 R-18 内容需要账号已通过年龄验证

---

## 4. Vercel Cron (定时任务安全)

### CRON_SECRET
- 用于确保只有 Vercel 的定时任务可以触发 `/api/cron` 接口
- 防止外部恶意请求触发抓取
- 可以自定义任意随机字符串（建议 32 位以上）

**生成方式:**
1. 使用密码生成器生成随机字符串
2. 或在终端运行: `openssl rand -hex 32`
3. 或直接编一个复杂的字符串

**示例:**
```
CRON_SECRET=my-super-secret-cron-token-12345-abcdef
```

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

## 6. GitHub 同步 (可选)

### GITHUB_TOKEN
- 用于将 R2 中的图片同步到 GitHub 仓库
- 图片会自动转换为 WebP 格式
- 自动重命名为 1.webp, 2.webp... 的格式
- 横屏图片上传到 `ri/h/`，竖屏图片上传到 `ri/v/`

**获取步骤:**
1. 登录 [GitHub](https://github.com/)
2. 点击右上角头像 -> **Settings**
3. 左侧菜单滚动到最底部 -> **Developer settings**
4. 点击 **Personal access tokens** -> **Tokens (classic)**
5. 点击 **Generate new token** -> **Generate new token (classic)**
6. 填写信息:
   - **Note**: 填写用途说明，如 `Pixiv-Sync`
   - **Expiration**: 选择过期时间（建议 90 days 或 No expiration）
   - **Select scopes**: 必须勾选 ✅ **`repo`** (完整仓库访问权限)
7. 点击 **Generate token**
8. **立即复制** 生成的 Token
9. ⚠️ **重要**: Token 只显示一次，离开页面后无法再查看！

**快捷链接:** https://github.com/settings/tokens/new

**目标仓库:**
- 横屏: `https://github.com/Hurt-In-Dream/EdgeOne_Function_PicAPI/tree/main/ri/h`
- 竖屏: `https://github.com/Hurt-In-Dream/EdgeOne_Function_PicAPI/tree/main/ri/v`

**示例:**
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## 7. 配置到 Vercel

### 添加环境变量
1. 登录 [Vercel](https://vercel.com/)
2. 进入你的项目 -> **Settings** -> **Environment Variables**
3. 逐个添加上述环境变量:
   - Key: 变量名（如 `NEXT_PUBLIC_SUPABASE_URL`）
   - Value: 变量值
   - Environment: 选择 **Production**, **Preview**, **Development** 全部勾选
4. 点击 **Save**
5. **重新部署** 项目以使变量生效

### 重新部署
添加或修改环境变量后，需要重新部署才能生效：
1. 进入 **Deployments** 标签页
2. 找到最近一次部署，点击右侧 **...** 菜单
3. 选择 **Redeploy**

> 💡 **提示**: 可以先在本地创建 `.env` 文件测试，然后再同步到 Vercel。本地 `.env` 文件内容与上述格式相同。

---

## 常见问题

### Q: 抓取失败显示 401 错误？
A: `PIXIV_PHPSESSID` 已过期，请重新获取。

### Q: 图片无法上传到 R2？
A: 检查 R2 API Token 权限是否包含 "Object Read & Write"。

### Q: GitHub 同步失败？
A: 检查 `GITHUB_TOKEN` 权限是否勾选了 `repo`，以及 Token 是否过期。

### Q: 定时任务没有执行？
A: 确认 `CRON_SECRET` 已配置，并且 `vercel.json` 中的 cron 规则正确。
