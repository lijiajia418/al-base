## implement-token-service: Token 会话服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现 Opaque Token 的创建、读取、删除、续期，基于 Redis 存储会话数据。

**DoD：**
实现类：
- [ ] `src/domains/auth/token-service.ts` 已创建
- [ ] `createSession(user)`: 生成 UUID token，存 Redis（TTL 7天），返回 token
- [ ] `getSession(token)`: 读取 session 数据（userId, phone, roles, schoolId, activeRole）
- [ ] `deleteSession(token)`: 删除 session
- [ ] `refreshSession(token)`: 剩余 TTL < 1天时续期到 7天
- [ ] `updateSession(token, data)`: 更新 session 字段（角色切换用）
- [ ] Redis key: `session:{tokenValue}`
测试类：
- [ ] 变更点测试：createSession → getSession 返回一致的用户数据
- [ ] 影响范围回归：无（新建代码）

**依赖：** setup-redis-client

**回滚策略：** 删除 `src/domains/auth/token-service.ts`

**影响的文件：**
- src/domains/auth/token-service.ts (新建)
