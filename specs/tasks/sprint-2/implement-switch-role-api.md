## implement-switch-role-api: POST /auth/switch-role

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现角色切换接口，更新 session 中的 activeRole。

**DoD：**
实现类：
- [ ] `src/app/api/v1/auth/switch-role/route.ts` 已创建
- [ ] 接收 { role }，校验 role ∈ user.roles
- [ ] 调用 authService.switchRole()，更新 Redis session
- [ ] 返回 { activeRole, profile }
测试类：
- [ ] 变更点测试：roles=['teacher','parent'] 的用户切换到 parent → activeRole 变更，返回 parent profile
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-role-injector

**回滚策略：** 删除 `src/app/api/v1/auth/switch-role/route.ts`

**影响的文件：**
- src/app/api/v1/auth/switch-role/route.ts (新建)
