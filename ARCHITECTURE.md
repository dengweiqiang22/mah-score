# mah-score 架构设计

## 一、整体架构

系统采用：

```

React（H5）
↓
Vercel Functions
↓
Vercel KV（Redis）

```

整个系统只有一个后端平台：

**Vercel。**

---

# 二、设计目标

架构目标：

- 简单
- 易维护
- 易扩展
- 基础设施最少

未来增加：

- 微信小程序
- PWA
- App

都必须继续使用同一套后端。

---

# 三、架构原则

遵循：

> 后端统一。

> 前端可替换。

任何客户端：

- H5
- 微信
- App

都应调用同一套 API。

不得复制业务逻辑。

---

# 四、为什么选择 Vercel

原因：

部署简单。

维护成本低。

支持 Serverless。

支持 Edge。

支持 KV。

支持 GitHub 自动部署。

适合个人长期维护。

---

# 五、为什么不使用微信云开发

微信云开发服务器主要位于国内。

项目主要用户位于：

印尼。

因此：

访问延迟较高。

本项目：

仅将微信小程序作为客户端。

业务仍然运行在：

Vercel。

---

# 六、数据存储

采用：

Vercel KV（Upstash Redis）。

原因：

简单。

可靠。

维护成本低。

无需维护数据库服务器。

---

# 七、数据模型

Room

```

room:{roomId}

```

Hash：

- version
- players
- status
- createdAt
- updatedAt

---

Event：

```

room:{roomId}:events

```

Redis List。

新增：

RPUSH

读取：

LRANGE

Event 永远追加。

不允许修改。

---

# 八、Event Sourcing

本项目采用：

Event Sourcing。

所有状态：

通过 Replay Event 得到。

Event 是：

唯一事实来源。

禁止：

修改历史 Event。

删除历史 Event。

---

# 九、同步机制

客户端采用：

Polling。

流程：

客户端：

```

GET /sync?version=10

```

服务器：

返回：

11~最新 Version。

减少重复传输。

当前版本：

不使用 WebSocket。

---

# 十、业务分层

建议目录：

```

src/

api/

domain/

services/

hooks/

components/

pages/

```

其中：

domain：

仅负责：

- Replay
- Score
- Undo
- Settlement

不得依赖：

React。

浏览器。

UI。

保持纯 TypeScript。

---

# 十一、未来扩展

新增客户端：

无需修改：

Domain。

API。

Redis。

Event。

仅增加：

新的 UI。

---

# 十二、技术决策原则

优先级：

简单

↓

可维护

↓

可读性

↓

开发效率

↓

性能

避免：

为了未来增加复杂度。

遵循：

KISS

YAGNI

SOLID（适度）

---

# 十三、最终目标

整个项目最终保持：

一套业务逻辑。

一套 API。

一套数据模型。

一个后端平台。

多个客户端。

降低长期维护成本。

这比任何性能优化都更加重要。