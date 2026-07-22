# backlog

---

# v0.16.0 候选任务

## 流局结算与房间桌规配置基础

任务文档：

docs/tasks/v0.16.0-draw-game-and-room-rules.md

目标：

- 补齐血战到底流局后的查花猪、查叫、退刮风下雨；
- 默认采用自摸加番；
- 预留未来房间创建或房间设置中的桌规配置；
- 保持所有分数来自 Event Replay。

---

# v0.16.1 候选任务

## 流局结算录入 UI 优化

任务文档：

docs/tasks/v0.16.1-draw-game-entry-ui.md

目标：

- 将流局状态录入并入主事件录入界面；
- 使用“先选状态，再点玩家”的流局交互；
- 在玩家卡片右侧展示 `🐷 花猪`、`未叫`、`听 N 番` 等状态标签；
- 保持 v0.16.0 的流局 payload 和 Replay 逻辑不变。

---

# v0.3.0 候选任务

## Event Sourcing 补齐第一阶段

### 目标

减少 Room Hash 中的重复业务状态，让 Event Log 更接近唯一事实来源。

### 任务

以下操作必须追加 Event：

- ROOM_CREATED
- PLAYER_JOINED
- PLAYER_RENAMED
- PLAYER_REMOVED
- GAME_STARTED

Room Hash 仅保留：

- version
- status
- createdAt
- updatedAt
- 必要缓存

### 涉及模块

backend/services/roomService.ts

backend/services/eventStore.ts

shared/src/domain/replay.ts

frontend/src/pages/RoomPage.tsx

### 验收标准

不再需要前端伪造 PLAYER_JOINED Event。

Replay 可恢复玩家列表、房间状态和分数。

旧房间数据兼容或有明确迁移策略。

---

## 并发安全第一阶段

### 目标

降低多人同时操作导致的数据覆盖风险。

### 任务

重点处理：

- 同时加入房间
- 同时开始游戏
- 同时计分
- 同时撤销

方案优先级：

1. Redis 原子操作
2. Redis 事务
3. Lua

### 涉及模块

backend/services/roomService.ts

backend/services/eventStore.ts

backend/api/room/*.ts

### 验收标准

不会因为并发加入丢失玩家。

不会出现重复版本号。

不会撤销同一个事件两次。
