## implement-class-apis: C1-C7 班级 API

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现班级管理 7 个接口。school_admin + teacher 可访问（teacher 受权限控制）。

**DoD：**
实现类：
- [ ] `src/app/api/v1/classes/route.ts` 已创建（GET 列表 + POST 创建）
- [ ] `src/app/api/v1/classes/[id]/route.ts` 已创建（GET 详情 + PUT 编辑）
- [ ] `src/app/api/v1/classes/[id]/status/route.ts` 已创建（PUT 归档/激活）
- [ ] `src/app/api/v1/classes/[id]/teachers/route.ts` 已创建（POST 分配老师）
- [ ] `src/app/api/v1/classes/[id]/teachers/[teacherId]/route.ts` 已创建（DELETE 移除老师）
- [ ] C1: GET /classes → 管理员全校/老师自己班
- [ ] C2: POST /classes → 创建班级，老师自动成为主讲
- [ ] C6: POST /classes/:id/teachers → 分配老师（含 teacherRoleId）
测试类：
- [ ] 变更点测试：POST /classes { name, grade } as teacher → 创建班级 + creator 自动加入 class_teachers
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-class-service, implement-permission-guard

**回滚策略：** 删除 `src/app/api/v1/classes/` 目录

**影响的文件：**
- src/app/api/v1/classes/ 目录下多个 route 文件 (新建)
