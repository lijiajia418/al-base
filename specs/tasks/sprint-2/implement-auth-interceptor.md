## implement-auth-interceptor: 认证拦截器中间件

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现 Next.js middleware，验证 Token 并注入用户上下文到请求中。白名单路由跳过验证。

**DoD：**
实现类：
- [ ] `src/lib/auth/auth-interceptor.ts` 已创建
- [ ] 白名单路由放行（/api/v1/auth/sms-code, /api/v1/auth/login, /api/v1/health）
- [ ] 提取 Authorization Bearer token → Redis 查 session → 注入 req.auth
- [ ] 无 token → 401 NO_TOKEN，token 无效 → 401 TOKEN_EXPIRED
- [ ] 自动续期（TTL < 1天时续到 7天）
测试类：
- [ ] 变更点测试：携带有效 token 的请求 → req.auth 包含正确的 userId/roles/schoolId
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-token-service

**回滚策略：** 删除 `src/lib/auth/auth-interceptor.ts`

**影响的文件：**
- src/lib/auth/auth-interceptor.ts (新建)
