## implement-role-injector: 角色解析中间件

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 解析当前请求使用的角色视角，从 X-Active-Role header 或 session 默认值。

**DoD：**
实现类：
- [ ] `src/lib/auth/role-injector.ts` 已创建
- [ ] 读取优先级：X-Active-Role header → session.activeRole → roles[0]
- [ ] 校验 requestedRole ∈ user.roles，否则 403 ROLE_NOT_ASSIGNED
- [ ] 将 activeRole 设置到请求上下文
测试类：
- [ ] 变更点测试：设置 X-Active-Role: parent → 请求上下文 activeRole = parent
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-auth-interceptor

**回滚策略：** 删除 `src/lib/auth/role-injector.ts`

**影响的文件：**
- src/lib/auth/role-injector.ts (新建)
