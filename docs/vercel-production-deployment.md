# Vercel 生产部署指南

本文档说明如何将 mah-score 部署到 Vercel 生产环境。

mah-score 当前部署目标只有一个：

**Vercel。**

数据存储使用：

**Vercel Marketplace / Upstash Redis。**

---

# 一、部署前准备

部署前需要准备：

- GitHub 仓库
- Vercel 账号
- Vercel 项目
- 已购买或已绑定到 Vercel 的域名
- Redis REST 连接信息

项目根目录必须保持为仓库根目录，不要把 Vercel Root Directory 指向 `frontend/`。

---

# 二、本地部署前检查

在项目根目录执行：

```bash
npm install
npm run check:deploy
```

`check:deploy` 会依次执行：

- TypeScript 检查
- ESLint
- 测试
- 构建

只有该命令通过后，才建议推送到 GitHub 并触发 Vercel 部署。

---

# 三、推送代码到 GitHub

确认本地检查通过后，由开发者执行：

```bash
git add .
git commit -m "chore: prepare vercel deployment"
git push
```

注意：

AI Agent 不执行 `git push`。

---

# 四、在 Vercel 导入项目

进入 Vercel 控制台：

1. 点击 `Add New Project`
2. 选择 GitHub 中的 mah-score 仓库
3. Root Directory 保持仓库根目录
4. Framework Preset 选择 `Vite`
5. 使用项目中的 `vercel.json` 配置

项目已有 `vercel.json`：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "framework": "vite",
  "installCommand": "npm install",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

因此 Vercel 配置应保持：

- Build Command：`npm run build`
- Install Command：`npm install`
- Output Directory：`frontend/dist`

---

# 五、配置 Redis 环境变量

后端依赖 Redis REST API。

生产环境必须配置：

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

配置位置：

```text
Vercel Project -> Settings -> Environment Variables
```

建议同时配置到：

- Production
- Preview

不要将真实 token 写入：

- `.env`
- `.env.example`
- GitHub 仓库
- 文档

---

# 六、创建或绑定 Redis

在 Vercel 中创建或绑定 Redis：

1. 进入 Vercel 项目
2. 打开 Storage 或 Marketplace
3. 选择 Redis / Upstash Redis
4. 创建数据库或绑定已有数据库
5. 获取 REST URL 和 REST TOKEN
6. 写入环境变量：

```text
KV_REST_API_URL=你的 Redis REST URL
KV_REST_API_TOKEN=你的 Redis REST TOKEN
```

当前项目只需要 Redis List 和 Hash 能力：

- `room:{roomId}`
- `room:{roomId}:events`

不需要 PostgreSQL、MySQL、MongoDB、Supabase、Firebase 或其他后端平台。

---

# 七、部署

完成环境变量配置后：

1. 如果项目首次导入，Vercel 会自动部署
2. 如果之前部署失败，点击 `Redeploy`
3. 后续推送到主分支会自动触发部署

如果构建失败，优先检查：

- Vercel Root Directory 是否为仓库根目录
- `npm install` 是否成功
- `npm run build` 是否成功
- 环境变量是否配置完整

---

# 八、绑定域名

如果域名已在 Vercel 购买：

1. 进入项目
2. 打开 `Settings -> Domains`
3. 添加域名
4. 设置为 Production Domain
5. 等待 SSL 证书自动签发

如果域名不在 Vercel 购买，需要按 Vercel 提示配置 DNS。

---

# 九、部署后验收

部署完成后，先验证健康检查：

```text
https://你的域名/api/health
```

预期返回：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  },
  "message": ""
}
```

然后进行完整手工验收：

- 首页可以打开
- 可以创建房间
- 邀请链接可以加入房间
- 4 名玩家可以开始游戏
- 可以记录点炮
- 可以记录自摸
- 可以记录直杠
- 可以记录暗杠
- 可以撤销计分事件
- 本局账单正确
- 历史账单正确
- 结算页正确
- 两个浏览器窗口可以通过 polling 同步事件

建议使用最新任务文档中的真实浏览器验收流程。

---

# 十、常见问题

## API 返回 Redis 未配置

检查 Vercel 环境变量：

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

确认变量已配置到当前部署环境。

修改环境变量后，需要重新部署。

## 页面能打开，但 API 404

检查：

- 根目录是否包含 `api/`
- Vercel Root Directory 是否为仓库根目录
- `api/room/*` 文件是否已提交到 GitHub

## 刷新房间页后 404

检查 `vercel.json` 中是否包含 SPA rewrite：

```json
{
  "source": "/(.*)",
  "destination": "/index.html"
}
```

## 构建失败

本地先执行：

```bash
npm run check:deploy
```

如果本地失败，先修复本地问题。

如果本地成功但 Vercel 失败，检查：

- Node 版本差异
- 依赖安装日志
- Vercel 项目根目录
- Workspace 依赖是否正确安装

---

# 十一、上线原则

生产环境不得执行危险操作：

- 不清空 Redis
- 不删除生产数据
- 不修改生产环境变量
- 不删除 Vercel 项目
- 不切换后端平台

如需进行上述操作，必须先人工确认。
