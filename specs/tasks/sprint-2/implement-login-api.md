## implement-login-api: POST /auth/login

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现验证码登录接口，校验验证码，返回 Token 和用户信息。

**DoD：**
实现类：
- [ ] `src/app/api/v1/auth/login/route.ts` 已创建
- [ ] 接收 { phone, code }，调用 authService.login()
- [ ] 返回 { token, user, isNewUser }
- [ ] 白名单路由，不需要 Token
测试类：
- [ ] 变更点测试：有效验证码 → 返回 token + user 对象
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-auth-service, implement-auth-interceptor

**回滚策略：** 删除 `src/app/api/v1/auth/login/route.ts`

**影响的文件：**
- src/app/api/v1/auth/login/route.ts (新建)
