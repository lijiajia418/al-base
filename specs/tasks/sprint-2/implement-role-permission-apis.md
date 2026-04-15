## implement-role-permission-apis: R1-R6 角色权限 API

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现角色权限管理 6 个接口。仅 school_admin 可访问。

**DoD：**
实现类：
- [ ] `src/app/api/v1/teacher-roles/route.ts` 已创建（GET 列表 + POST 创建）
- [ ] `src/app/api/v1/teacher-roles/[id]/route.ts` 已创建（GET 详情 + PUT 编辑）
- [ ] `src/app/api/v1/teacher-roles/[id]/permissions/route.ts` 已创建（PUT 配置权限）
- [ ] `src/app/api/v1/permissions/route.ts` 已创建（GET 权限列表）
- [ ] R1: GET /teacher-roles → 角色列表含 teacherCount, permissionCount
- [ ] R2: POST /teacher-roles → 创建角色
- [ ] R3: GET /teacher-roles/:id → 详情含权限列表
- [ ] R4: PUT /teacher-roles/:id → 编辑角色
- [ ] R5: PUT /teacher-roles/:id/permissions → 全量替换权限
- [ ] R6: GET /permissions → 所有可分配权限
测试类：
- [ ] 变更点测试：POST /teacher-roles { name, code } as school_admin → 创建角色成功
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-role-permission-service, implement-permission-guard

**回滚策略：** 删除 `src/app/api/v1/teacher-roles/` 和 `src/app/api/v1/permissions/` 目录

**影响的文件：**
- src/app/api/v1/teacher-roles/ 目录 (新建)
- src/app/api/v1/permissions/route.ts (新建)
