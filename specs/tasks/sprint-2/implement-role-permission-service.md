## implement-role-permission-service: 角色权限服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现 teacher_roles CRUD、权限分配、权限查询和校验。

**DoD：**
实现类：
- [ ] `src/domains/permission/role-permission-service.ts` 已创建
- [ ] `createRole(schoolId, name, code, description?)`: 创建角色，校验 school+code 唯一
- [ ] `listRoles(schoolId)`: 列出学校的角色（含 teacherCount, permissionCount）
- [ ] `getRole(roleId)`: 角色详情含 permissions 列表
- [ ] `updateRole(roleId, data)`: 编辑名称/描述/状态
- [ ] `setPermissions(roleId, permissionIds[])`: 全量替换角色权限
- [ ] `listPermissions()`: 列出所有可分配权限
- [ ] `checkPermission(teacherRoleId, permissionCode)`: 校验角色是否有某权限
测试类：
- [ ] 变更点测试：createRole + setPermissions([ids]) → getRole 返回正确的权限列表
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-auth-interceptor

**回滚策略：** 删除 `src/domains/permission/role-permission-service.ts`

**影响的文件：**
- src/domains/permission/role-permission-service.ts (新建)
