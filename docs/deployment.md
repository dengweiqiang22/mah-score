# 部署说明

mah-score 当前只部署到 Vercel。

## 部署前检查

提交或部署前执行：

```bash
npm run check:deploy
```

该命令会执行：

- TypeScript 检查
- ESLint
- Replay 测试
- 前端、后端、shared 构建

## Vercel 项目配置

`vercel.json` 已配置：

```json
{
  "buildCommand": "npm run build",
  "framework": "vite",
  "installCommand": "npm install",
  "outputDirectory": "frontend/dist"
}
```

Vercel 项目根目录保持仓库根目录。

## 环境变量

线上必须配置：

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

这些变量由 Vercel KV 提供。不要把真实 token 写入仓库。

## API 路由

Vercel Functions 入口位于根目录 `api/`：

```text
api/health.ts
api/room/index.ts
api/room/create.ts
api/room/events.ts
api/room/join.ts
api/room/player/remove.ts
api/room/player/rename.ts
api/room/start.ts
api/room/score.ts
api/room/undo.ts
api/room/sync.ts
```

前端构建产物位于 `frontend/dist`。

## 部署后手工验收

部署完成后，至少验证：

- 首页可打开
- 可以创建房间
- 可以通过房间号加入房间
- 2 名玩家可以开始游戏
- 可以记录自摸
- 可以记录点炮
- 可以记录流局
- 可以撤销上一局
- 两个浏览器窗口可以通过 polling 同步事件
- `/api/health` 返回成功响应

## 不做的事情

MVP 阶段不配置：

- 登录系统
- 自建 Redis
- WebSocket
- 其他后端平台
