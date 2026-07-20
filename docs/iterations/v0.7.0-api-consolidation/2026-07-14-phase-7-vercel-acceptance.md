# v0.7.0 Phase 7 Vercel 线上验收

验收时间：2026-07-14T12:24:23Z

线上地址：

- `https://mah-score.vercel.app/`
- 最新 Production Deployment：`dpl_GBRLtYWF6LvgyUFtt1v4sZybcEDj`
- 最新部署 Commit：`b90c5f61d95c70cc4393a91d94e33346f2c770a8`

---

# 一、验收结论

v0.7.0 线上验收通过。

核心结论：

- 最新 Production Deployment 状态为 `READY`。
- Vercel metadata 显示当前 Node.js Serverless Functions 数量为 `2`。
- root `api/` 目录当前只有两个实际 Function 入口：
  - `api/health.ts`
  - `api/room.ts`
- 线上 `/api/health` 正常。
- 线上统一 `/api/room` 创建、加入、读取、同步、开始游戏均正常。
- 最近 10 分钟生产日志无 `error` 或 `fatal`。
- `vercel.json` 当前无需立即修改。

---

# 二、Vercel MCP 查询结果

## 项目

项目：

- Name：`mah-score`
- Project ID：`prj_pazvCRDMp91b1ZxQIK6DDhz95q76`
- Framework：`vite`
- Node Version：`24.x`
- Latest Deployment：`dpl_GBRLtYWF6LvgyUFtt1v4sZybcEDj`
- Latest Deployment State：`READY`
- Target：`production`

域名：

- `mah-score.vercel.app`
- `mah-score-dengwq.vercel.app`
- `mah-score-git-main-dengwq.vercel.app`

## Serverless Functions 数量

最新 deployment metadata：

```json
{
  "lambdaRuntimeStats": "{\"nodejs\":2}"
}
```

结论：

当前线上使用 `2` 个 Node.js Serverless Functions。

这符合 v0.7.0 的 API 数量收敛目标，并低于 Vercel 免费额度限制。

## 近期运行日志

最近 10 分钟生产日志按状态码统计：

| 状态码 | 数量 | 说明 |
| --- | ---: | --- |
| 200 | 19 | 正常请求 |
| 201 | 1 | 创建房间成功 |
| 404 | 1 | 验收中请求不存在房间的预期结果 |

最近 10 分钟生产日志错误查询：

- `error`：0
- `fatal`：0

按 requestPath 统计时仍观察到 `/api/room/sync` 请求。

复核结果：

- 当前线上 JS bundle 只包含 `/api/room`。
- 当前线上 JS bundle 包含 `action=sync`。
- 当前线上 JS bundle 未发现 `/api/room/sync`、`/api/room/create`、`/api/room/join` 旧路径引用。

判断：

`/api/room/sync` 日志大概率来自旧页面会话、历史浏览器缓存或 Vercel route 归类残留。当前最新静态资源已经切换到统一 `/api/room` 入口。

---

# 三、线上 Smoke Test

## Health

请求：

```bash
curl https://mah-score.vercel.app/api/health
```

结果：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  },
  "message": ""
}
```

HTTP 状态：`200`

耗时：约 `0.45s`

## 不存在房间同步

请求：

```bash
curl "https://mah-score.vercel.app/api/room?action=sync&roomId=999&version=0"
```

结果：

```json
{
  "success": false,
  "message": "房间不存在。",
  "code": "ROOM_NOT_FOUND"
}
```

HTTP 状态：`404`

说明：

这是预期结果，用于确认统一 API 入口和错误格式正常。

## 创建房间

请求：

```bash
curl -X POST https://mah-score.vercel.app/api/room \
  -H "Content-Type: application/json" \
  --data '{"action":"create","nickname":"验收张"}'
```

结果：

- HTTP 状态：`201`
- 房间号：`101`
- 初始版本：`2`
- 初始事件：
  - `ROOM_CREATED`
  - `PLAYER_JOINED`

## 加入房间

请求：

```bash
curl -X POST https://mah-score.vercel.app/api/room \
  -H "Content-Type: application/json" \
  --data '{"action":"join","roomId":"101","nickname":"验收李"}'
```

结果：

- HTTP 状态：`200`
- 加入成功
- 后续同步读取到 `PLAYER_JOINED` version `3`

## 读取房间详情

请求：

```bash
curl "https://mah-score.vercel.app/api/room?roomId=101"
```

结果：

- HTTP 状态：`200`
- 房间版本：`3`
- 玩家：
  - `验收张`
  - `验收李`
- 状态：`WAITING`

## 开始游戏

请求：

```bash
curl -X POST https://mah-score.vercel.app/api/room \
  -H "Content-Type: application/json" \
  --data '{"action":"start","roomId":"101"}'
```

结果：

- HTTP 状态：`200`
- 开始成功

再次读取房间：

- 房间版本：`4`
- 状态：`PLAYING`
- 新增事件：`GAME_STARTED`

## 页面路由

请求：

```bash
curl -I https://mah-score.vercel.app/room/101
```

结果：

- HTTP 状态：`200`
- `content-type`: `text/html; charset=utf-8`
- `x-vercel-id`: `sin1::...`

说明：

SPA fallback 正常，线上 Function 区域命中 `sin1`。

---

# 四、Function 数量验收

本地部署入口：

```text
api/health.ts
api/room.ts
api/tsconfig.json
```

其中实际 Vercel Function：

- `api/health.ts`
- `api/room.ts`

Vercel 最新 deployment metadata：

```text
lambdaRuntimeStats = {"nodejs":2}
```

结论：

当前线上免费 Serverless API 使用数量为 `2`。

---

# 五、vercel.json 复核

当前配置：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"],
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

## 保留项

### `regions`

建议保留：

```json
"regions": ["sin1"]
```

原因：

- 当前用户场景在印尼工业园区。
- Redis 区域已经按新加坡方向优化。
- 线上页面响应 `x-vercel-id` 显示命中 `sin1`。
- 保持 Function 与 Redis 区域接近，有利于降低 KV 往返延迟。

### `framework`

建议保留：

```json
"framework": "vite"
```

原因：

- 当前前端技术栈是 Vite。
- Vercel 项目识别结果也是 `vite`。

### `buildCommand`

建议保留：

```json
"buildCommand": "npm run build"
```

原因：

- 根构建脚本已显式按 `shared -> backend -> frontend` 顺序构建。
- 这对 workspace 项目是必要的。

### `outputDirectory`

建议保留：

```json
"outputDirectory": "frontend/dist"
```

原因：

- 当前前端构建产物在 `frontend/dist`。

### SPA fallback rewrite

当前：

```json
"rewrites": [
  {
    "source": "/(.*)",
    "destination": "/index.html"
  }
]
```

建议暂时保留。

原因：

- Vercel 文档中这是 SPA fallback 的常见配置。
- `/room/101` 已验证可正常返回 `index.html`。
- API route 仍能正常优先响应 `/api/health` 与 `/api/room`。

## 暂不建议修改项

### 不建议增加兼容旧 API 路径的 rewrite

例如：

```json
{
  "source": "/api/room/create",
  "destination": "/api/room"
}
```

原因：

- 新 API 依赖 body 中的 `action` 字段。
- 旧请求 body 不包含 `action`，简单 rewrite 无法完整兼容。
- 为旧路径做兼容需要在 router 中额外判断 pathname，会增加维护成本。
- 当前最新前端 bundle 已经不引用旧路径。

### 暂不建议增加 `functionFailoverRegions`

原因：

- 当前 Redis 主要区域与 `sin1` 对齐。
- failover 到其他区域可能增加 Redis 跨区延迟。
- MVP 阶段优先保持简单。

### 暂不建议配置单独的 `functions` maxDuration

原因：

- 当前 API 都是轻量 KV 读写。
- 线上 smoke test 延迟约 `0.24s` 到 `0.52s`。
- 暂无超时迹象。

---

# 六、发现的问题与后续建议

## 1. 旧路径请求仍出现在近期日志中

现象：

Vercel runtime logs 最近 10 分钟 requestPath 仍出现 `/api/room/sync`。

复核：

- 最新线上 bundle 不包含 `/api/room/sync`。
- 最新线上 bundle 使用 `/api/room?action=sync...`。

建议：

观察 24 小时。

如果 24 小时后仍有大量旧路径请求，再考虑：

- 在 router 中增加旧路径兼容。
- 或在 `vercel.json` 中明确让旧 API 路径返回 410。

当前不建议立即处理。

## 2. DNS 解析偶发失败

现象：

验收过程中 `curl https://mah-score.vercel.app/` 出现过短暂 DNS resolve failure，重试后正常。

影响：

当前判断为验收环境网络波动，不是应用错误。

建议：

后续线上验收可多跑几次，记录失败率。

---

# 七、最终结论

v0.7.0 线上部署达到预期：

- API 数量已从原来的 12 个左右收敛到 2 个。
- 最新 Production Deployment 正常。
- 统一 `/api/room` 入口可用。
- Event Sourcing 关键路径线上可运行。
- `vercel.json` 当前配置适合 MVP 阶段，无需立即修改。

下一步建议：

进入 v0.7.0 收尾：

- 将本文档作为线上验收记录。
- 观察 24 小时 Vercel runtime logs。
- 若无异常，可开始规划 v0.8.0。
