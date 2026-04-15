## implement-auth-service: 登录认证服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现登录编排逻辑：校验验证码 → 查找/创建用户 → 签发 Token。

**DoD：**
实现类：
- [ ] `src/domains/auth/auth-service.ts` 已创建
- [ ] `login(phone, code)`: 校验验证码 → 查 users 表 → 不存在则创建 → 创建 session → 返回 { token, user, isNewUser }
- [ ] 首次登录时 status 从 pending_activation → active
- [ ] `logout(token)`: 删除 session
- [ ] `switchRole(token, role)`: 校验 role ∈ user.roles → 更新 session activeRole
测试类：
- [ ] 变更点测试：有效验证码 + 新手机号 → 创建用户 + 返回 token + isNewUser=true
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-sms-service, implement-token-service

**回滚策略：** 删除 `src/domains/auth/auth-service.ts`

**影响的文件：**
- src/domains/auth/auth-service.ts (新建)
