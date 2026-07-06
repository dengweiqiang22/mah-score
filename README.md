# mah-score

轻量级四川麻将 H5 计分工具。

## 技术栈

- React + TypeScript + Vite
- Vercel Functions
- Vercel KV
- Event Sourcing

## 本地开发

安装依赖：

```bash
npm install
```

准备环境变量：

```bash
cp .env.example .env
```

本地 `.env` 默认使用 SRH 模拟 Vercel KV：

```text
KV_REST_API_URL=http://127.0.0.1:8079
KV_REST_API_TOKEN=mah_score_dev_token
```

启动开发环境：

```bash
npm run dev
```

默认访问：

```text
http://localhost:5173/
```

## 常用命令

```bash
npm run check
npm run test
npm run build
npm run check:deploy
```

`check:deploy` 用于部署前检查，会依次执行 TypeScript、ESLint、测试和构建。

## 部署

部署目标是 Vercel，数据存储使用 Vercel KV。部署步骤见：

[docs/deployment.md](docs/deployment.md)
