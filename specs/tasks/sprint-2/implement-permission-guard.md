## implement-permission-guard: 权限校验中间件

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现三层权限判定：身份角色（代码路由映射）→ 职能权限（数据库查 teacher_roles）→ 资源归属（关系表）。

**DoD：**
实现类：
- [ ] `src/lib/auth/permission-guard.ts` 已创建
- [ ] 第一层：路由级身份角色检查（ROUTE_ROLES 映射表）
- [ ] 第二层：teacher 职能权限检查（查 teacher_role_permissions + permissions）
  - scope=global → 查 teacher_profiles.teacher_role_id
  - scope=class → 查 class_teachers.teacher_role_id（空则回退全局）
- [ ] 第三层：资源归属校验辅助函数（teacher→班级、parent→孩子）
测试类：
- [ ] 变更点测试：teacher 无 task:assign 权限 → 请求布置任务 → 403 PERMISSION_DENIED
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-role-injector

**回滚策略：** 删除 `src/lib/auth/permission-guard.ts`

**影响的文件：**
- src/lib/auth/permission-guard.ts (新建)
