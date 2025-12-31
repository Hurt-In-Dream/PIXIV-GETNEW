# 环境变量获取指南

本项目需要配置多个第三方服务的环境变量才能正常运行。以下是详细的获取步骤。

## 1. Supabase (数据库)

前往 [Supabase 官网](https://supabase.com/) 注册并创建一个新项目。

- **NEXT_PUBLIC_SUPABASE_URL**: 
  - 进入项目设置 (Settings) -> API。
  - 在 "Project Config" 下找到 `Project URL`。
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**:
  - 进入项目设置 (Settings) -> API。
  - 在 "Project API keys" 下找到 `anon` `public` 对应的 Key。
- **SUPABASE_SERVICE_ROLE_KEY**:
  - 进入项目设置 (Settings) -> API。
  - 在 "Project API keys" 下找到 `service_role` `secret` 对应的 Key。
  - **注意**: 此 Key 具有最高权限，请勿泄露。

## 2. Cloudflare R2 (对象存储)

登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。

- **R2_ACCOUNT_ID**:
  - 在 Cloudflare 首页右侧或 R2 概览页面可以找到 `Account ID`。
- **R2_ACCESS_KEY_ID** & **R2_SECRET_ACCESS_KEY**:
  - 进入 R2 页面，点击右侧的 "Manage R2 API Tokens"。
  - 点击 "Create API token"。
  - 权限选择 "Edit"，存储桶选择 "Specific buckets" (选择你创建的桶) 或 "All buckets"。
  - 创建后会显示 `Access Key ID` 和 `Secret Access Key`。**请务必立即保存，因为 Secret 之后无法再次查看。**
- **R2_BUCKET_NAME**:
  - 你在 R2 中创建的存储桶 (Bucket) 的名称。
- **R2_PUBLIC_URL**:
  - 进入你的存储桶设置 (Settings)。
  - 在 "Public Access" 下，你可以绑定自定义域名或开启 `r2.dev` 临时子域名。
  - 格式通常为 `https://pub-xxx.r2.dev` 或你的自定义域名。

## 3. Pixiv (数据源)

你需要一个已登录的 Pixiv 账号来获取 Cookie。

- **PIXIV_PHPSESSID**:
  - 在电脑浏览器打开 [Pixiv](https://www.pixiv.net) 并登录。
  - 按 `F12` 打开开发者工具。
  - 切换到 **Application** (应用程序) 选项卡。
  - 在左侧菜单找到 **Cookies** -> `https://www.pixiv.net`。
  - 找到 `PHPSESSID`，复制它的 `Value`。
  - **注意**: 如果你退出登录或 Cookie 过期，需要重新获取。

## 4. Vercel Cron (定时任务安全)

- **CRON_SECRET**:
  - 这是一个自定义的随机字符串，用于确保只有 Vercel 的定时任务可以触发 `/api/cron` 接口。
  - 你可以随便输入一串长随机字符，或者在 Vercel 项目设置的 `Environment Variables` 中生成一个。
  - 部署后，Vercel 会自动在 Cron 请求头中带上 `Authorization: Bearer <YOUR_CRON_SECRET>`。
