# backlog

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
