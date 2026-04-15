## implement-logout-api: POST /auth/logout

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现登出接口，删除 Redis session，Token 即时失效。

**DoD：**
实现类：
- [ ] `src/app/api/v1/auth/logout/route.ts` 已创建
- [ ] 从 req.auth 获取 token，调用 tokenService.deleteSession()
- [ ] 需要有效 Token
测试类：
- [ ] 变更点测试：登出后再用同一 token 请求 → 401
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-token-service, implement-auth-interceptor

**回滚策略：** 删除 `src/app/api/v1/auth/logout/route.ts`

**影响的文件：**
- src/app/api/v1/auth/logout/route.ts (新建)
