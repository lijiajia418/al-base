# WebSocket 框架架构文档

---

## 1. 架构概览

### 1.1 整体分层架构图

```
+============================================================+
|                     客户端 (Browser)                        |
|                                                            |
|  +------------------+    +-----------------------------+   |
|  | SocketProvider   |    | useSocketStore (Zustand)     |   |
|  | (React Context)  |--->| socket / sessionId / messages|   |
|  +------------------+    +-----------------------------+   |
|         |                          |                       |
|         |     socket.io-client     |                       |
+==========|==========================|======================+
           |  WebSocket / Polling     |
+==========|==========================|======================+
|          v                          v                      |
|  +----------------------------------------------------+   |
|  |            Socket.IO Server (TypedServer)           |   |
|  +----------------------------------------------------+   |
|         |                                                  |
|         v                                                  |
|  +----------------------------------------------------+   |
|  |          Middleware Chain (auth, ...)               |   |
|  |  socket.handshake.auth --> socket.data              |   |
|  +----------------------------------------------------+   |
|         |                                                  |
|         v                                                  |
|  +----------------------------------------------------+   |
|  |          Handler Registry (插件式注册)               |   |
|  |  +----------------+  +-------------------------+    |   |
|  |  | session:join   |  | message:direct          |    |   |
|  |  | session:leave  |  | (future domain handlers)|    |   |
|  |  +----------------+  +-------------------------+    |   |
|  +----------------------------------------------------+   |
|         |                                                  |
|         v                                                  |
|  +------------------------+  +-------------------------+   |
|  | SessionManager         |  | Context (singleton)     |   |
|  | bySessionId Map        |  | getIO() / getSessMgr()  |   |
|  | socketToSession Map    |  | (供 API Routes 使用)    |   |
|  +------------------------+  +-------------------------+   |
|                                                            |
|                     服务端 (Node.js)                        |
+============================================================+
```

### 1.2 技术选型

本框架基于 **Socket.IO v4** 构建，选型原因如下：

- **传输回退**：自动在 WebSocket、HTTP Long-Polling 之间切换，兼容企业网络代理
- **内置重连**：客户端 SDK 提供自动重连、指数退避，无需手写
- **Room 抽象**：原生 `socket.join(room)` / `io.to(room).emit()` 语义，简化分组推送
- **TypeScript 泛型支持**：Server/Socket 接受四个泛型参数（C2S、S2C、InterServer、SocketData），实现端到端类型安全
- **Ack 回调**：事件支持 acknowledgement 回调，实现请求-响应语义

### 1.3 核心设计原则

| 原则 | 体现 |
|------|------|
| **关注点分离** | ws 框架（`src/lib/ws/`）与业务领域（`src/domains/`）物理隔离；框架不包含任何业务逻辑 |
| **接口驱动** | `ISessionManager`、`IHandlerRegistry` 均为 interface，实现可替换 |
| **类型安全** | `TypedHandlerFn<K>` 在注册时通过泛型约束推导所有参数类型；运行时分发使用 `unknown[]` 透传 |
| **插件式扩展** | `HandlerRegistrar` 函数作为插件注册到 `createSocketServer`，新增领域零改动框架代码 |
| **依赖注入** | `CoreDeps -> AppDeps` 泛型链，handler 通过 deps 参数获取所有依赖 |

---

## 2. 目录结构

```
src/
  lib/ws/
    index.ts                    -- 统一导出桶文件，外部统一从此导入
    types.ts                    -- Payload 类型、EventMap、TypedServer/Socket 别名、泛型工具
    server.ts                   -- createSocketServer 工厂函数，组装所有部件
    context.ts                  -- 模块级 singleton，供 API Routes 获取 io/sessionManager
    session/
      types.ts                  -- SessionEntry 接口、ISessionManager 接口契约
      session-manager.ts        -- SessionManager 实现（双 Map 内存存储）
    registry/
      types.ts                  -- IHandlerRegistry、CoreDeps、HandlerRegistrar 类型定义
      handler-registry.ts       -- HandlerRegistry 实现（Map<event, handler[]> + disconnect 列表）
    middleware/
      index.ts                  -- applyMiddleware 工具函数、SocketMiddleware 类型、导出 authMiddleware
      auth.middleware.ts         -- 认证中间件 (MVP stub)

  domains/
    session/
      session.handlers.ts       -- session:join / session:leave 业务处理
    messaging/
      messaging.handlers.ts     -- message:direct 消息中继业务处理

  stores/
    socket-store.ts             -- Zustand store，管理客户端 socket 连接和消息状态

  components/providers/
    socket-provider.tsx          -- React Provider 组件，自动连接/断开 socket

server.ts                       -- 自定义 HTTP Server 入口，组装 Next.js + Socket.IO
```

---

## 3. 核心工作部件

### 3.1 类型契约 (`src/lib/ws/types.ts`)

#### Event Map 设计

文件定义了 Socket.IO 的四个泛型映射（第 46-69 行）：

```typescript
ClientToServerEvents   // 客户端 -> 服务端事件（session:join, session:leave, message:direct）
ServerToClientEvents   // 服务端 -> 客户端事件（session:joined, session:error, message:receive）
InterServerEvents      // 多服务实例间事件（目前仅 ping 占位）
SocketData             // 附着在 socket.data 上的会话数据
```

事件名遵循 `domain:action` 命名范式（详见第 5 节）。

#### TypedHandlerFn 泛型推导链路

```
ClientToServerEvents["session:join"]
    |
    v
Parameters<...> = [SessionJoinPayload, (res: AckResponse) => void]
    |
    v  EventParams<"session:join">
    |
    v
TypedHandlerFn<"session:join"> = (socket: TypedSocket, payload: SessionJoinPayload, ack: ...) => void
```

推导过程（第 101-121 行）：

1. `EventParams<K>` 使用 `Parameters<ClientToServerEvents[K]>` 提取事件函数的参数元组
2. `TypedHandlerFn<K>` 将 `socket: TypedSocket` 前置，再展开 `...EventParams<K>`
3. 业务代码调用 `registry.on("session:join", (socket, payload, ack) => {...})` 时，`payload` 和 `ack` 的类型由 TypeScript 自动推断，无需手动标注

#### Payload 设计原则

- **Ack 模式**（请求-响应）：`session:join` 的第二个参数是 `ack: (res: AckResponse) => void`，客户端可通过回调获取服务端确认结果（第 47-50 行）
- **Fire-and-forget 模式**：`message:direct`、`session:leave` 无 ack 参数，适用于不需要同步确认的场景（第 51-53 行）
- **AckResponse** 统一结构：`{ ok: boolean; sessionId?: string; error?: string }`（第 36-40 行）

### 3.2 SessionManager

**源文件**: `src/lib/ws/session/session-manager.ts`

#### 双 Map 数据结构

```typescript
private bySessionId    = new Map<string, SessionEntry>();   // 第 5 行
private socketToSession = new Map<string, string>();         // 第 7 行
```

**设计原因**：

- `bySessionId`：按业务 sessionId 查询，用于消息路由（`sessionManager.get(targetSessionId)`）
- `socketToSession`：按 Socket.IO 内部 socketId 反查 sessionId，用于 **disconnect 时 O(1) 清理**（第 35-42 行）

如果只有一个 Map，disconnect 回调中只能拿到 `socket.id`，需要 O(n) 遍历才能找到对应的 session。

#### 接口方法及使用场景

| 方法 | 使用场景 |
|------|----------|
| `add(sessionId, entry)` | `session:join` handler 注册新会话（`session.handlers.ts:24`） |
| `get(sessionId)` | 消息路由时查找目标会话（`messaging.handlers.ts:29`） |
| `getBySocketId(socketId)` | handler 中根据当前 socket 查询发送者信息（`messaging.handlers.ts:11`） |
| `remove(sessionId)` | 重复 join 时移除旧会话（`session.handlers.ts:20`） |
| `removeBySocketId(socketId)` | disconnect 时框架自动清理（`server.ts:102`） |
| `list()` | API Route 列出所有在线会话 |
| `has(sessionId)` / `size()` | 检查会话存在 / 统计在线数 |

#### 水平扩展路径

`ISessionManager` 接口（`session/types.ts:9-18`）定义了完整契约。当需要水平扩展（多进程/多机器）时：

1. 实现 `ISessionManager` 接口，底层使用 Redis 或其他共享存储
2. 在 `server.ts` 中替换 `new SessionManager()` 为 `new RedisSessionManager(redisClient)`
3. 框架代码（`server.ts`、`context.ts`）通过接口引用，零改动

### 3.3 HandlerRegistry

**源文件**: `src/lib/ws/registry/handler-registry.ts`

#### 插件式注册模式

```
registerSessionHandlers(registry, deps)    -- 注册 session:join, session:leave
registerMessagingHandlers(registry, deps)  -- 注册 message:direct
```

每个 `HandlerRegistrar` 函数是一个独立插件，通过 `createSocketServer` 的 `handlerRegistrars` 数组注入（`server.ts:69-71`）：

```typescript
for (const registrar of handlerRegistrars) {
  registrar(registry, deps);
}
```

新增业务只需编写新的 registrar 函数并追加到数组，无需修改框架代码。

#### 类型安全在注册时强制执行的机制

`IHandlerRegistry.on()` 方法签名（`registry/types.ts:40-43`）：

```typescript
on<K extends keyof ClientToServerEvents>(
  event: K,
  handler: TypedHandlerFn<K>,
): void;
```

- 当调用 `registry.on("session:join", handler)` 时，`K` 被推断为 `"session:join"`
- `TypedHandlerFn<"session:join">` 展开后精确约束 handler 的参数类型
- 如果 handler 参数类型不匹配，**编译期即报错**

存储时，`TypedHandlerFn<K>` 被向上转型为 `InternalHandlerFn`（`handler-registry.ts:19`）：

```typescript
existing.push(handler as InternalHandlerFn);
```

这是有意为之的设计：**注册时类型安全，分发时运行时透传**。因为 `Map<string, InternalHandlerFn[]>` 无法按事件名保留各自的泛型参数，所以分发阶段（`server.ts:83`）使用 `...args: unknown[]` 透传。

#### onDisconnect 两阶段设计

disconnect 处理分为两个阶段（`server.ts:100-116`）：

```
阶段 1 (框架层): sessionManager.removeBySocketId(socket.id)
    |
    v  返回被移除的 SessionEntry (或 undefined)
    |
阶段 2 (业务层): registry.getDisconnectHandlers() 逐个执行
    每个 handler 接收 (socket, reason, entry)
```

- **阶段 1** 由框架统一执行，确保 SessionManager 状态一致性
- **阶段 2** 将已移除的 `entry` 传递给业务 handler（`DisconnectHandlerFn` 签名见 `registry/types.ts:29-33`），业务层可用 entry 中的 sessionId、userId 等信息通知其他用户、持久化状态等
- 即使 `entry` 为 `undefined`（socket 从未 join 过 session），业务 handler 仍会被调用，由业务层自行判断

### 3.4 Middleware Chain

**源文件**: `src/lib/ws/middleware/index.ts`、`auth.middleware.ts`

#### 执行时机

中间件在 **Socket.IO connection 事件触发之前** 执行。`io.use(mw)` 注册的中间件在每个新连接握手阶段运行（`middleware/index.ts:8-15`）。

```
客户端 connect
    |
    v
[authMiddleware] --> [middleware2] --> ... --> [middlewareN]
    |                                              |
    |  next(err?) 决定是否继续                      |
    v                                              v
          connection 事件触发 (server.ts:74)
```

#### 管道式架构

```typescript
export type SocketMiddleware = (
  socket: TypedSocket,
  next: (err?: Error) => void,
) => void;
```

- 调用 `next()` 继续管道
- 调用 `next(new Error(...))` 终止连接，客户端收到 `connect_error`

`applyMiddleware` 按数组顺序注册（`middleware/index.ts:8-15`），Socket.IO 按注册顺序执行。

#### socket.data 传递链路

```
authMiddleware (middleware/auth.middleware.ts:13-16)
    socket.handshake.auth.userId --> socket.data.userId
        |
        v
connection handler (server.ts:74)
    socket.data.userId 已可用
        |
        v
session:join handler (session.handlers.ts:27)
    payload.userId ?? socket.data.userId  --> sessionManager.add(...)
```

中间件通过 `socket.data` 向下游传递数据，所有 handler 均可访问。`SocketData` 类型（`types.ts:65-69`）定义了 `socket.data` 的结构。

### 3.5 Server Factory (`createSocketServer`)

**源文件**: `src/lib/ws/server.ts`

#### 组装流程（4步）

```
步骤 1: 创建 TypedServer 实例 (server.ts:51-60)
    new SocketServer<C2S, S2C, Inter, Data>(httpServer, { cors, ping* })
        |
        v
步骤 2: 注册中间件链 (server.ts:63)
    applyMiddleware(io, middlewares)
        |
        v
步骤 3: 构建 Handler Registry (server.ts:66-71)
    new HandlerRegistry()
    deps = { io, sessionManager, ...extraDeps }
    for registrar of handlerRegistrars: registrar(registry, deps)
        |
        v
步骤 4: 绑定 connection handler (server.ts:74-117)
    io.on("connection", socket => {
      为每个注册事件 socket.on(event, dispatch)
      socket.on("disconnect", cleanup + business handlers)
    })
```

#### 泛型 Deps 链

```
CoreDeps = { io: TypedServer; sessionManager: ISessionManager }
    |
    v  extends
AppDeps = CoreDeps & { db: DrizzleDB; llmClient: LLMClient; ... }
    |
    v
CreateSocketServerOptions<D extends CoreDeps>
    extraDeps?: Omit<D, keyof CoreDeps>     -- 自动排除 io 和 sessionManager
    handlerRegistrars?: HandlerRegistrar<D>[]
```

在 `server.ts:67`，deps 通过展开合并：

```typescript
const deps = { io, sessionManager, ...extraDeps } as D;
```

handler registrar 通过泛型参数 `D` 获得完整的依赖类型。

#### 错误隔离策略

- **事件 handler 错误**（`server.ts:85-95`）：`try/catch` 捕获后向客户端 emit `session:error`，并 `break` 终止当前事件的后续 handler。不会导致 socket 断开。
- **disconnect handler 错误**（`server.ts:112-114`）：`try/catch` 捕获后仅 `console.error`，不会影响其他 disconnect handler 的执行（无 `break`）。
- **中间件错误**：通过 `next(err)` 传递，Socket.IO 自动终止该连接。

### 3.6 Context (`src/lib/ws/context.ts`)

#### 模块级 singleton 设计

```typescript
let _io: TypedServer | null = null;             // 第 4 行
let _sessionManager: ISessionManager | null = null;  // 第 5 行
```

- **设计约束**：模块级变量依赖 Node.js 的模块缓存机制，**同一进程中只有一个实例**
- 在 `server.ts:36` 启动时调用 `setWSContext(io, sessionManager)` 初始化
- `getIO()` / `getSessionManager()` 在未初始化时抛出明确的错误信息

#### 使用场景

| 函数 | 使用者 | 场景 |
|------|--------|------|
| `getIO()` | Next.js API Route | 后端主动向客户端推送事件：`getIO().to(room).emit(...)` |
| `getSessionManager()` | Next.js API Route | 查询在线用户列表、检查用户是否在线 |

**重要**：这两个函数只能在服务端代码中调用，不能在客户端组件中使用。

---

## 4. 运行流程图

### 4.1 服务启动流程

```
server.ts (入口)
    |
    v
[1] app = next({ dev, hostname, port })
    app.prepare()
    |
    v
[2] httpServer = createServer(handle)
    sessionManager = new SessionManager()
    |
    v
[3] io = createSocketServer({
      httpServer,
      sessionManager,
      middlewares: [authMiddleware],
      handlerRegistrars: [registerSessionHandlers, registerMessagingHandlers],
      cors: {...}
    })
    |
    |   内部执行:
    |   3a. new SocketServer(httpServer, opts)
    |   3b. applyMiddleware(io, [authMiddleware])
    |   3c. registry = new HandlerRegistry()
    |       registerSessionHandlers(registry, deps)  --> 注册 session:join, session:leave
    |       registerMessagingHandlers(registry, deps) --> 注册 message:direct
    |   3d. io.on("connection", connectionHandler)
    |
    v
[4] setWSContext(io, sessionManager)
    |
    v
[5] httpServer.listen(port)
    --> "Ready on http://localhost:3000"
    --> "WebSocket server attached"
```

### 4.2 客户端连接 -> session:join -> 加入会话

```
Browser                           Server
  |                                 |
  |  useSocketStore.connect()       |
  |  socket = io({ auth:{userId} })|
  |                                 |
  |---- WebSocket Upgrade --------->|
  |                                 |
  |                          authMiddleware(socket, next)
  |                            socket.data.userId = userId
  |                            next()
  |                                 |
  |                          io.on("connection") 触发
  |                            为 session:join/leave/message:direct
  |                            绑定 socket.on(event, dispatch)
  |                                 |
  |<--- "connect" event ------------|
  |                                 |
  |  socket.on("connect") 触发      |
  |  socket.emit("session:join",    |
  |    { sessionId, userId },       |
  |    ackCallback)                 |
  |---- "session:join" ------------>|
  |                                 |
  |                          session.handlers.ts:
  |                            sessionId = payload.sessionId || randomUUID()
  |                            sessionManager.add(sessionId, {...})
  |                            socket.data.sessionId = sessionId
  |                            socket.join("session:<id>")
  |                            socket.emit("session:joined", {...})
  |                            ack({ ok: true, sessionId })
  |                                 |
  |<--- "session:joined" ---------- |
  |<--- ack response --------------|
  |                                 |
  |  set({ sessionId })             |
  |  (Zustand state 更新)            |
```

### 4.3 用户A -> 用户B 消息中继

```
User A (Browser)              Server                    User B (Browser)
  |                             |                             |
  | sendDirect(targetId,        |                             |
  |   "hello", "text")          |                             |
  |                             |                             |
  |-- "message:direct" ------->|                             |
  |  { targetSessionId,        |                             |
  |    content, type }         |                             |
  |                             |                             |
  |                      messaging.handlers.ts:              |
  |                        senderEntry = getBySocketId(A.id) |
  |                        if (!senderEntry) emit error      |
  |                        targetEntry = get(targetSessionId)|
  |                        if (!targetEntry) emit error      |
  |                             |                             |
  |                        io.to("session:<targetId>")       |
  |                          .emit("message:receive", {      |
  |                            fromSessionId,                |
  |                            content, type, metadata       |
  |                          })                              |
  |                             |                             |
  |                             |-- "message:receive" ------>|
  |                             |                             |
  |                             |                      socket.on("message:receive")
  |                             |                        set(state => ({
  |                             |                          messages: [..., payload]
  |                             |                        }))
  |                             |                        (React 组件自动更新)
```

### 4.4 后端主动推送流程 (API Route -> getIO -> emit)

```
External Trigger (e.g. webhook, cron)
    |
    v
Next.js API Route  (e.g. /api/notify)
    |
    import { getIO, getSessionManager } from "@/lib/ws"
    |
    const io = getIO()
    const sm = getSessionManager()
    |
    v
[查询目标] entry = sm.get(targetSessionId)
    |
    |  if (!entry) return 404
    |
    v
[推送事件] io.to(`session:${targetSessionId}`)
             .emit("message:receive", {
               fromSessionId: "system",
               content: "...",
               type: "system"
             })
    |
    v
客户端 socket.on("message:receive") 触发
    Zustand store 更新 --> React 组件渲染
```

### 4.5 断线 -> disconnect handler 清理

```
Browser                           Server
  |                                 |
  |  (网络断开 / 页面关闭 /         |
  |   disconnect() 调用)            |
  |                                 |
  |----X connection lost X--------->|
  |                                 |
  |                          socket.on("disconnect") 触发
  |                                 |
  |                          阶段 1 (框架层, server.ts:102):
  |                            entry = sessionManager.removeBySocketId(socket.id)
  |                            bySessionId.delete(sessionId)
  |                            socketToSession.delete(socketId)
  |                            console.log("session <id> disconnected: <reason>")
  |                                 |
  |                          阶段 2 (业务层, server.ts:109-115):
  |                            for handler of disconnectHandlers:
  |                              handler(socket, reason, entry)
  |                              (当前无业务 disconnect handler 注册)
  |                                 |
  |                          Socket.IO 自动从所有 room 移除 socket
```

### 4.6 客户端重连流程

```
Browser                           Server
  |                                 |
  |  (连接意外断开)                  |
  |                                 |
  |  socket.on("disconnect") 触发   |
  |  set({ connected: false })      |
  |                                 |
  |  (socket.io-client 自动重连      |
  |   reconnectionAttempts: 10      |
  |   reconnectionDelay: 1000ms     |
  |   reconnectionDelayMax: 5000ms) |
  |                                 |
  |---- 重新 WebSocket Upgrade ---->|
  |                                 |
  |                          authMiddleware 重新执行
  |                          io.on("connection") 重新绑定 handler
  |                                 |
  |<--- "connect" event ------------|
  |                                 |
  |  socket.on("connect") 触发      |
  |  (注意: 与首次连接走同一逻辑)     |
  |  socket.emit("session:join",    |
  |    { sessionId, userId }, ack)  |
  |---- "session:join" ------------>|
  |                                 |
  |                          session.handlers.ts:
  |                            sessionId 与断线前相同 (客户端保留了 state)
  |                            if (sessionManager.has(sessionId))
  |                              sessionManager.remove(sessionId)  -- 清除残留
  |                            sessionManager.add(sessionId, {...})
  |                            socket.join("session:<id>")
  |                                 |
  |<--- ack({ ok, sessionId }) ----|
  |                                 |
  |  会话恢复完成                    |
```

关键点：
- 客户端 `connect` 回调中每次都执行 `session:join`（`socket-store.ts:52-59`），无论首次还是重连
- `sessionManager.has()` 检查防止旧 entry 残留（`session.handlers.ts:19-21`）
- Zustand store 中 `sessionId` 在重连时通过 ack 回调刷新

---

## 5. 事件协议参考

### 5.1 事件表格

| 事件名 | 方向 | Payload | Ack | 用途 |
|--------|------|---------|-----|------|
| `session:join` | Client -> Server | `SessionJoinPayload { sessionId?, userId? }` | `AckResponse { ok, sessionId?, error? }` | 客户端加入/恢复会话 |
| `session:leave` | Client -> Server | (无) | 无 | 客户端主动离开会话 |
| `session:joined` | Server -> Client | `SessionJoinedPayload { sessionId, connectedAt }` | -- | 通知客户端已成功加入会话 |
| `session:error` | Server -> Client | `ErrorPayload { code, message }` | -- | 通用错误通知 |
| `message:direct` | Client -> Server | `DirectMessagePayload { targetSessionId, content, type, metadata? }` | 无 | 发送点对点消息 |
| `message:receive` | Server -> Client | `MessageReceivedPayload { fromSessionId, content, type, metadata? }` | -- | 接收消息（含中继和系统推送） |
| `ping` | Server <-> Server | (无) | -- | 多实例间心跳（InterServerEvents 占位） |

### 5.2 命名规范

- **格式**: `domain:action`，使用冒号分隔
- **domain**: 业务领域名（`session`、`message`）
- **action**: 动词或动词短语（`join`、`leave`、`direct`、`receive`）
- **方向约定**:
  - 客户端发起的命令用主动语态：`session:join`、`message:direct`
  - 服务端推送的事件用被动/完成语态：`session:joined`、`message:receive`
- **错误事件**: 统一使用 `session:error`（未来可拆分为 `domain:error`）

### 5.3 错误码

| 错误码 | 产生位置 | 含义 |
|--------|----------|------|
| `HANDLER_ERROR` | `server.ts:89` | handler 抛出未捕获异常 |
| `NOT_IN_SESSION` | `messaging.handlers.ts:15` | 发送消息但未 join session |
| `INVALID_PAYLOAD` | `messaging.handlers.ts:22` | 缺少必填字段 |
| `TARGET_NOT_FOUND` | `messaging.handlers.ts:33` | 目标 session 不在线 |

---

## 6. 开发手册

### 6.1 新增业务领域 (以 "tutor" 领域为例)

**目标**：新增 `tutor:ask` 事件，学生向 tutor session 发送问题，tutor 收到 `tutor:question` 推送。

**Step 1**: 定义 Payload 类型，编辑 `src/lib/ws/types.ts`

```typescript
// --- 新增 Payload ---
export interface TutorAskPayload {
  tutorSessionId: string;
  question: string;
}

export interface TutorQuestionPayload {
  fromSessionId: string;
  question: string;
  askedAt: string;
}

// --- 修改 Event Map ---
export interface ClientToServerEvents {
  // ...existing...
  "tutor:ask": (payload: TutorAskPayload) => void;
}

export interface ServerToClientEvents {
  // ...existing...
  "tutor:question": (payload: TutorQuestionPayload) => void;
}
```

**Step 2**: 创建 handler 文件 `src/domains/tutor/tutor.handlers.ts`

```typescript
import type { IHandlerRegistry, CoreDeps } from "@/lib/ws/registry/types";

export function registerTutorHandlers(
  registry: IHandlerRegistry,
  deps: CoreDeps,
): void {
  const { io, sessionManager } = deps;

  // payload: TutorAskPayload -- 自动推断
  registry.on("tutor:ask", (socket, payload) => {
    const sender = sessionManager.getBySocketId(socket.id);
    if (!sender) {
      socket.emit("session:error", {
        code: "NOT_IN_SESSION",
        message: "Join a session first",
      });
      return;
    }

    const tutor = sessionManager.get(payload.tutorSessionId);
    if (!tutor) {
      socket.emit("session:error", {
        code: "TUTOR_NOT_FOUND",
        message: "Tutor is not online",
      });
      return;
    }

    io.to(`session:${payload.tutorSessionId}`).emit("tutor:question", {
      fromSessionId: sender.sessionId,
      question: payload.question,
      askedAt: new Date().toISOString(),
    });
  });
}
```

**Step 3**: 在 `server.ts` 注册

```typescript
import { registerTutorHandlers } from "./src/domains/tutor/tutor.handlers";

const io = createSocketServer({
  // ...existing...
  handlerRegistrars: [
    registerSessionHandlers,
    registerMessagingHandlers,
    registerTutorHandlers,     // <-- 新增
  ],
});
```

**Step 4**: 在 `src/lib/ws/index.ts` 导出新类型（供客户端使用）

```typescript
export type { TutorAskPayload, TutorQuestionPayload } from "./types";
```

完成。无需修改框架核心代码（`server.ts` 工厂、`handler-registry.ts`、`middleware/`）。

### 6.2 新增中间件 (以 rate-limit 为例)

**Step 1**: 创建 `src/lib/ws/middleware/rate-limit.middleware.ts`

```typescript
import type { TypedSocket } from "../types";

const connectionCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;   // 1 分钟窗口
const MAX_CONNECTIONS = 10;  // 每 IP 最多 10 次连接

/**
 * 限制每个 IP 在窗口期内的连接次数。
 * 超限时调用 next(Error) 拒绝连接。
 */
export function rateLimitMiddleware(
  socket: TypedSocket,
  next: (err?: Error) => void,
): void {
  const ip = socket.handshake.address;
  const now = Date.now();

  let record = connectionCounts.get(ip);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS };
    connectionCounts.set(ip, record);
  }

  record.count++;

  if (record.count > MAX_CONNECTIONS) {
    next(new Error("Rate limit exceeded. Try again later."));
    return;
  }

  next();
}
```

**Step 2**: 在 `src/lib/ws/middleware/index.ts` 导出

```typescript
export { rateLimitMiddleware } from "./rate-limit.middleware";
```

**Step 3**: 在 `server.ts` 启用

```typescript
import { rateLimitMiddleware } from "./src/lib/ws/middleware/rate-limit.middleware";

const io = createSocketServer({
  // ...
  middlewares: [rateLimitMiddleware, authMiddleware],
  //            ^^^ rate limit 先于 auth 执行
});
```

中间件按数组顺序执行，建议 rate-limit 放在最前面，避免为被限流的连接执行认证逻辑。

### 6.3 扩展 Deps (注入数据库访问)

**Step 1**: 定义 AppDeps 类型

```typescript
// src/types/app-deps.ts
import type { CoreDeps } from "@/lib/ws/registry/types";
import type { db } from "@/db";

export interface AppDeps extends CoreDeps {
  db: typeof db;
}
```

**Step 2**: handler 使用扩展 deps

```typescript
// src/domains/tutor/tutor.handlers.ts
import type { IHandlerRegistry } from "@/lib/ws/registry/types";
import type { AppDeps } from "@/types/app-deps";
import type { HandlerRegistrar } from "@/lib/ws/registry/types";

export const registerTutorHandlers: HandlerRegistrar<AppDeps> = (
  registry,
  deps,
) => {
  const { io, sessionManager, db } = deps;  // db 类型安全可用

  registry.on("tutor:ask", async (socket, payload) => {
    // 使用 db 持久化提问记录
    await db.insert(questions).values({
      fromSessionId: socket.data.sessionId,
      question: payload.question,
    });
    // ...
  });
};
```

**Step 3**: 在 `server.ts` 传入 extraDeps

```typescript
import { db } from "./src/db";

const io = createSocketServer<AppDeps>({
  httpServer,
  sessionManager,
  middlewares: [authMiddleware],
  handlerRegistrars: [
    registerSessionHandlers,           // CoreDeps 也兼容 AppDeps
    registerMessagingHandlers,
    registerTutorHandlers,             // HandlerRegistrar<AppDeps>
  ],
  extraDeps: { db },                   // Omit<AppDeps, keyof CoreDeps> = { db }
});
```

注意：`CoreDeps` 类型的 registrar 可以赋值给 `HandlerRegistrar<AppDeps>`（因为 `AppDeps extends CoreDeps`），所以旧的 handler 无需改动。

### 6.4 新增推送事件

**目标**: 从 API Route 推送 `notification:new` 事件。

**Step 1**: 在 `types.ts` 的 `ServerToClientEvents` 新增

```typescript
export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface ServerToClientEvents {
  // ...existing...
  "notification:new": (payload: NotificationPayload) => void;
}
```

**Step 2**: 在 API Route 中推送

```typescript
// src/app/api/notifications/route.ts
import { getIO, getSessionManager } from "@/lib/ws";

export async function POST(req: Request) {
  const { targetSessionId, title, body } = await req.json();

  const sm = getSessionManager();
  if (!sm.has(targetSessionId)) {
    return Response.json({ error: "User offline" }, { status: 404 });
  }

  const io = getIO();
  io.to(`session:${targetSessionId}`).emit("notification:new", {
    id: crypto.randomUUID(),
    title,
    body,
    createdAt: new Date().toISOString(),
  });
  // ^^ "notification:new" 的 payload 类型由 ServerToClientEvents 约束
  //    传入错误字段会编译报错

  return Response.json({ ok: true });
}
```

### 6.5 客户端消费新事件

**Step 1**: 在 Zustand store 中监听

```typescript
// src/stores/socket-store.ts
import type { NotificationPayload } from "@/lib/ws/types";

export interface SocketState {
  // ...existing...
  notifications: NotificationPayload[];
}

// 在 connect() 函数内，socket.on("connect") 回调之后:
socket.on("notification:new", (payload) => {
  // payload: NotificationPayload -- 自动推断
  set((state) => ({
    notifications: [...state.notifications, payload],
  }));
});
```

**Step 2**: 在 React 组件中消费

```tsx
// src/components/notification-bell.tsx
"use client";

import { useSocketStore } from "@/stores/socket-store";

export function NotificationBell() {
  const notifications = useSocketStore((s) => s.notifications);
  const count = notifications.length;

  return (
    <div>
      <span>Notifications: {count}</span>
      <ul>
        {notifications.map((n) => (
          <li key={n.id}>
            <strong>{n.title}</strong>: {n.body}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

该组件需要被包裹在 `<SocketProvider>` 内，以确保 socket 连接已建立：

```tsx
<SocketProvider sessionId="..." userId="...">
  <NotificationBell />
</SocketProvider>
```

### 6.6 双通道推送（PushService：Socket.IO + 原生推送）

本节描述 `src/lib/push/` 推送策略层的设计，它解决了**iOS/Android App 进后台后 WebSocket 断开导致消息无法送达**的问题。

#### 核心架构

```
消息到达 PushService.deliver()
              │
              ▼
   sessionManager.has(targetId)?
         │              │
        Yes             No
         │              │
         ▼              ▼
   Socket.IO       deviceRegistry.getBySessionId(targetId)?
   实时投递              │              │
                      有 token        无 token
                        │              │
                        ▼              ▼
                   原生推送          仅存储
                  (APNs/FCM)     (待下次上线拉取)
```

#### 目录结构

```
src/lib/push/
├── types.ts            PushMessage, INativePushProvider, IDeviceRegistry 接口
├── push-service.ts     核心路由决策
├── device-registry.ts  内存设备注册表（sessionId → platform + pushToken）
├── apns-provider.ts    APNs 推送实现（MVP 为 stub）
└── index.ts            统一导出

src/domains/device/
└── device.handlers.ts  device:register 事件 + disconnect 时清理设备注册
```

#### 核心文件说明

**PushService** (`src/lib/push/push-service.ts`)

消息投递的唯一决策点。接收 `PushServiceDeps` 注入：

```typescript
interface PushServiceDeps {
  io: TypedServer;
  sessionManager: ISessionManager;
  deviceRegistry: IDeviceRegistry;
  nativePushProviders?: INativePushProvider[];  // APNs, FCM 等
}
```

核心方法 `deliver(message: PushMessage): Promise<PushResult>`，三条路径：

| 路径 | 条件 | 行为 | PushResult.channel |
|------|------|------|-------------------|
| 实时 | `sessionManager.has(targetId) === true` | `io.to(room).emit()` | `"socketio"` |
| 原生推送 | 离线 + deviceRegistry 有 pushToken | APNs/FCM 发送通知 | `"native"` |
| 仅存储 | 离线 + 无 pushToken | 返回未投递，由调用方决定是否存库 | `"stored"` |

**DeviceRegistry** (`src/lib/push/device-registry.ts`)

内存双 Map（与 SessionManager 同模式）：

```
bySessionId: sessionId → DeviceInfo { platform, pushToken, userId }
byUserId:    userId    → DeviceInfo
```

客户端通过 `device:register` 事件上报平台和推送 token，disconnect 时自动清理。

**INativePushProvider** (`src/lib/push/types.ts`)

原生推送的统一接口，按平台实现：

```typescript
interface INativePushProvider {
  readonly platform: string;  // "ios", "android"
  send(pushToken: string, notification: NativeNotification): Promise<boolean>;
}
```

当前提供 `APNsProvider`（stub）。生产实现需对接 Apple HTTP/2 Push API。

#### 事件协议

`types.ts` 中新增的事件：

| 事件 | 方向 | Payload | 用途 |
|------|------|---------|------|
| `device:register` | C→S | `{ platform: "ios"\|"android"\|"web", pushToken?: string }` + ack | 客户端上报设备信息和推送 token |

#### 组装方式（server.ts）

PushService 在 `server.ts` 组合根中创建，通过闭包注入到 handler registrar：

```typescript
const deviceRegistry = new DeviceRegistry();

createSocketServer({
  httpServer,
  sessionManager,
  handlerRegistrars: [
    registerSessionHandlers,
    (registry, deps) => {
      const pushService = new PushService({
        io: deps.io,
        sessionManager: deps.sessionManager,
        deviceRegistry,
        nativePushProviders: [new APNsProvider()],
      });
      registerMessagingHandlers(registry, { ...deps, pushService });
    },
    (registry, deps) => {
      registerDeviceHandlers(registry, { ...deps, deviceRegistry });
    },
  ],
});
```

#### iOS 客户端对接流程

```
iOS App 启动
   │
   ▼
1. 向 APNs 注册 → 获得 deviceToken
   │
   ▼
2. socket.io-client-swift 连接服务器
   socket.emit("session:join", ...)
   │
   ▼
3. socket.emit("device:register", {
     platform: "ios",
     pushToken: deviceToken
   })
   │
   ▼
4. 正常收发消息（Socket.IO 通道）
   │
   ▼
App 进入后台 → iOS 挂起连接 → 服务端 disconnect
   │
   ▼
5. 有人发消息 → PushService.deliver()
   → sessionManager.has() = false
   → deviceRegistry 有 pushToken
   → APNsProvider.send() → 系统推送通知
   │
   ▼
6. 用户点击通知 → App 恢复前台
   → Socket.IO 自动重连 → session:join
   → 拉取离线消息
```

#### 新增原生推送平台（如 Android FCM）

遵循现有模式，不改核心代码：

**Step 1**: 实现 `INativePushProvider`

```typescript
// src/lib/push/fcm-provider.ts
export class FCMProvider implements INativePushProvider {
  readonly platform = "android";

  async send(pushToken: string, notification: NativeNotification): Promise<boolean> {
    // 调用 Firebase Cloud Messaging API
    // ...
    return true;
  }
}
```

**Step 2**: 在 `server.ts` 注册

```typescript
nativePushProviders: [new APNsProvider(), new FCMProvider()],
```

PushService 内部按 `device.platform` 自动匹配对应的 provider，零逻辑修改。

#### 生产化 APNs 实现要点

当前 `APNsProvider` 是 stub（仅打印日志）。生产实现需要：

1. **Apple 开发者账号** — 生成 APNs Auth Key (.p8 文件)
2. **环境变量** — `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_KEY_PATH`
3. **HTTP/2 连接** — Node.js `http2` 模块连接 `api.push.apple.com`
4. **JWT 签名** — 用 P8 密钥签署请求
5. **Token 失效处理** — HTTP 410 响应表示 token 失效，需从 DeviceRegistry 移除

---

## 7. 架构约束与边界

### 7.1 单进程单 Context 约束

`context.ts` 使用模块级变量存储 `_io` 和 `_sessionManager`（第 4-5 行），依赖 Node.js 的模块缓存机制（`require.cache`）。

**约束**：

- 同一进程中只能有一个 Socket.IO 实例。调用 `setWSContext` 两次会静默覆盖。
- 不适用于 serverless 函数（如 Vercel Edge Functions），因为每次调用可能是新进程。
- Next.js 的 API Routes 在同一 Node.js 进程中运行时可正常工作（`server.ts` 自定义服务器模式）。

**突破路径**：

- 单机多核：使用 `cluster` 模式 + Socket.IO Redis Adapter
- 多机器：`ISessionManager` 替换为 Redis 实现 + Socket.IO Redis Adapter
- Serverless：不适用实时 WebSocket，需要独立部署 WebSocket 服务

### 7.2 类型安全边界

```
完全类型安全区域                     运行时透传区域
+-------------------------------+    +-----------------------------+
| registry.on("event", handler) |    | server.ts:83                |
| TypedHandlerFn<K> 编译期约束   | -> | (socket as any).on(event,   |
| 参数类型精确推断               |    |   async (...args: unknown[]) |
+-------------------------------+    +-----------------------------+
                                          |
                                          v
                                     handler(socket, ...args)
                                     // args 类型在 handler 内部
                                     // 由注册时的泛型保证
```

**注册时 (编译期)**: `IHandlerRegistry.on<K>()` 的泛型约束确保 handler 签名与 `ClientToServerEvents[K]` 精确匹配。传入错误类型的 handler 会导致编译错误。

**分发时 (运行时)**: `Map<string, InternalHandlerFn[]>` 存储时擦除了具体事件的泛型参数，`server.ts:83` 使用 `any` cast + `unknown[]` 透传。这是有意的设计权衡：

- Map 的 key 是 `string`，无法在值的类型上保留与 key 关联的泛型参数
- 安全性由"注册时已验证"保证——只要注册时类型正确，分发时参数一定匹配

**客户端**: `socket.io-client` 的 `Socket<ServerToClientEvents, ClientToServerEvents>` 泛型同样在编译期保证 `emit` 和 `on` 的类型安全。

### 7.3 认证 stub 说明及生产化路径

当前 `authMiddleware`（`middleware/auth.middleware.ts`）是 MVP stub：

```typescript
export function authMiddleware(socket, next) {
  const { userId } = socket.handshake.auth as { userId?: string };
  if (userId) {
    socket.data.userId = userId;
  }
  next();   // <-- 始终放行，不做验证
}
```

**存在的问题**：
- 客户端可伪造任意 userId
- 无 token 验证，任何人都能连接
- 无权限控制

**生产化路径**：

1. **JWT 验证**：客户端在 `auth` 中传递 JWT token，中间件解码验证

```typescript
export function authMiddleware(socket: TypedSocket, next: (err?: Error) => void): void {
  const { token } = socket.handshake.auth as { token?: string };

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    socket.data.userId = decoded.sub;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
}
```

2. **客户端适配**：`socket-store.ts` 中 `io({ auth: { token } })` 替换 `userId`

3. **刷新机制**：监听 `connect_error`，在 token 过期时刷新后重连

4. **可选增强**：
   - 基于角色的事件权限（在 handler 层检查 `socket.data.role`）
   - 多租户隔离（在中间件中设置 `socket.data.tenantId`）
   - 会话绑定（确保 sessionId 与 userId 的归属关系）
