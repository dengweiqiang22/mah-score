# mah-score 项目宪法（Project Constitution）

> 本文档定义了 mah-score 项目的开发规范。
>
> 所有 AI Agent（Codex、ChatGPT 等）在执行任何任务前，都必须遵循本文档。
>
> 当本文档与个人习惯冲突时，以本文档为准。

---

# 一、项目目标

mah-score 是一个轻量级四川麻将计分工具。

第一阶段目标：

- H5（Web）
- 中国人在印尼工业园区内部使用
- 好友分享即可开始使用
- 无需下载安装
- 快速完成一局麻将计分

长期目标：

- 增加微信小程序客户端
- 保持同一套后端
- 保持同一套业务逻辑
- 保持最低维护成本

本项目属于长期维护项目，由个人维护。

所有技术决策都应优先考虑：

> **未来三年的维护成本，而不是当前开发速度。**

---

# 二、设计哲学

始终遵循以下原则：

简单 > 炫技

稳定 > 新技术

可维护 > 极致性能

可读性 > 技巧

一个平台 > 多个平台

少依赖 > 多依赖

成熟方案 > 前沿方案

不要为了"以后可能会用到"而增加复杂度。

遵循 KISS（Keep It Simple）。

---

# 三、技术栈

## 前端

- React
- TypeScript
- Vite
- TailwindCSS

## 后端

- Vercel Functions

## 数据存储

- Vercel KV（Upstash Redis）

## 部署

- Vercel

整个项目只有一个后端平台：

**Vercel。**

未经明确要求，不得主动引入：

- Supabase
- Firebase
- Railway
- Render
- PostgreSQL
- MySQL
- MongoDB

---

# 四、系统架构

采用 Event Sourcing。

Event Log 是唯一事实来源（Single Source of Truth）。

任何业务状态，都必须通过 Replay Event 得到。

原则：

- Event 只能追加
- 不允许修改历史 Event
- 不允许删除历史 Event
- 不保存重复业务数据（缓存除外）
- 所有计算均来自 Event Replay

---

# 五、整体架构原则

后端统一。

前端可替换。

所有业务逻辑必须独立于 UI。

未来新增：

- 微信小程序
- PWA
- App

都必须继续使用：

- 同一套 API
- 同一套业务逻辑
- 同一套数据模型

不得因为新增客户端而复制业务代码。

---

# 六、目录设计原则

推荐目录：

src/

api/

components/

pages/

hooks/

domain/

services/

types/

utils/

其中：

domain/

存放：

- Score
- Replay
- Settlement
- Undo
- Event

domain 不允许依赖：

- React
- 浏览器 API
- UI

domain 必须保持纯 TypeScript。

---

# 七、Redis 数据模型

Room

Key：

room:{roomId}

类型：

Hash

字段：

- version
- players
- status
- createdAt
- updatedAt

Event Log

Key：

room:{roomId}:events

类型：

Redis List

新增事件：

RPUSH

读取事件：

LRANGE

禁止整体覆盖 Event List。

---

# 八、同步机制

采用 Polling。

当前版本：

不使用 WebSocket。

客户端：

GET /api/room/{id}/sync?version=xx

服务器：

仅返回 Version 之后新增 Event。

每新增一个 Event：

Version +1。

采用乐观并发控制。

---

# 九、API 规范

统一返回格式：

成功：

{
    "success": true,
    "data": {},
    "message": ""
}

失败：

{
    "success": false,
    "message": "",
    "code": ""
}

禁止返回多个不同格式。

---

# 十、TypeScript 规范

开启 Strict。

禁止滥用 any。

优先 Interface。

类型保持完整。

优先 readonly。

类型安全优先于开发效率。

---

# 十一、React 规范

仅使用 Functional Component。

使用 Hooks。

禁止 Class Component。

组件保持单一职责。

公共逻辑抽离 Hook。

避免 Props Drill。

保持组件简单。

---

# 十二、状态管理

优先 Local State。

仅在确有需要时使用全局状态。

未经允许：

不要引入 Redux。

---

# 十三、UI 设计原则

Mobile First。

保持：

- 简洁
- 快速
- 易操作

按钮适合单手点击。

保持统一间距。

保持统一视觉。

减少动画。

UI 服务于计分。

---

# 十四、代码规范

代码首先给人阅读。

其次才给机器执行。

原则：

- 一个函数一个职责
- 保持函数简短
- 命名清晰
- 不过度抽象
- 不过度封装
- 不过早优化

优先简单实现。

---

# 十五、依赖管理

新增依赖前必须思考：

是否真的需要？

是否值得维护？

是否已有方案可以实现？

尽量减少依赖。

避免 Dependency Hell。

---

# 十六、异常处理

不得吞异常。

必须：

- 输出有意义信息
- 方便定位
- 不暴露敏感信息

---

# 十七、性能原则

不要进行过早优化。

只有确认存在瓶颈后再优化。

减少：

- 重复计算
- 重复请求
- 无意义渲染

不要为了微小性能提升增加复杂度。

---

# 十八、测试原则

每个功能至少验证：

- Replay
- Undo
- 分数计算
- 数据同步
- 边界情况

确保不影响已有功能。

---

# 十九、Git 规范

AI 禁止执行：

- git push
- git force-push
- git reset --hard
- git rebase

允许：

- git diff
- git status

Commit 必须由开发者确认。

Commit message 必须使用以下格式：

标题：

type(scope): 中文摘要

正文：

- 说明具体变更一
- 说明具体变更二
- 说明具体变更三

要求：

- 标题使用中文摘要
- 标题后空一行再写正文
- 正文使用短横线列表
- 正文每条描述一个具体变更
- 避免只写单行 commit message

---

# 二十、危险操作

未经确认：

禁止：

- 删除用户数据
- 清空 Redis
- 修改生产环境
- 修改环境变量
- 修改部署配置
- 删除重要文件

危险操作必须等待确认。

---

# 二十一、AI 工作流程

收到需求后必须遵循：

① 理解需求

② 阅读相关代码

③ 分析现有架构

④ 输出实现方案

⑤ 等待确认（复杂需求）

⑥ 开始开发

⑦ 自检

⑧ 检查是否影响已有功能

⑨ 总结修改内容

禁止直接修改代码。

---

# 二十二、MVP 原则

当前项目处于 MVP 阶段。

优先：

- 能完成需求
- 易维护
- 易理解

避免：

- 提前设计复杂架构
- 提前支持未来功能
- 提前优化

遵循：

You Aren't Gonna Need It（YAGNI）。

---

# 二十三、技术决策优先级

存在多个方案时，按以下顺序选择：

1. 简单
2. 易维护
3. 可读性
4. 基础设施最少
5. 开发效率
6. 性能

性能不是第一优先级。

---

# 二十四、最终原则

始终记住：

后端只有一套。

业务逻辑只有一套。

数据模型只有一套。

客户端可以有很多。

如果未来新增：

- 微信小程序
- PWA
- App

都必须继续复用：

- Vercel Functions
- Vercel KV
- Domain
- Event Sourcing

避免出现多个版本的业务逻辑。

---

# 二十五、项目信条

优秀的软件，并不是最复杂的软件。

而是：

最容易维护的软件。

当存在多个可行方案时，请始终选择：

**未来六个月后的自己，也能一眼看懂的方案。**

牢记：

> **简单，是最高级的设计。**
