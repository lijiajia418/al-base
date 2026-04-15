## implement-me-api: GET /auth/me

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现获取当前用户信息接口，返回用户基本信息 + 当前激活角色的 profile。

**DoD：**
实现类：
- [ ] `src/app/api/v1/auth/me/route.ts` 已创建
- [ ] 从 req.auth 获取 userId，查询 users 表 + 对应角色 profile
- [ ] 返回 user 信息（含 activeRole、schoolName、profile 对象）
- [ ] 手机号脱敏（中间 4 位用 * 替换）
测试类：
- [ ] 变更点测试：已登录用户 → 返回完整用户信息含 profile
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-auth-interceptor

**回滚策略：** 删除 `src/app/api/v1/auth/me/route.ts`

**影响的文件：**
- src/app/api/v1/auth/me/route.ts (新建)
