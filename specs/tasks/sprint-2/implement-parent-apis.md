## implement-parent-apis: P1-P4 家长 API

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现家长管理 4 个接口。P1-P3 仅 school_admin + teacher，P4 仅 parent。

**DoD：**
实现类：
- [ ] `src/app/api/v1/students/[studentId]/parents/route.ts` 已创建（POST 添加 + GET 列表）
- [ ] `src/app/api/v1/parents/relations/[id]/route.ts` 已创建（PUT 更新绑定状态）
- [ ] `src/app/api/v1/parents/children/route.ts` 已创建（GET 我的孩子）
- [ ] P1: POST /students/:sid/parents → 绑定家长
- [ ] P2: GET /students/:sid/parents → 学生的家长列表
- [ ] P3: PUT /parents/relations/:id → 更新绑定状态
- [ ] P4: GET /parents/children → 家长查看自己的孩子列表
测试类：
- [ ] 变更点测试：POST /students/:sid/parents { phone, relationType } → 绑定家长成功
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-parent-service, implement-permission-guard

**回滚策略：** 删除相关 route 文件

**影响的文件：**
- src/app/api/v1/students/[studentId]/parents/route.ts (新建)
- src/app/api/v1/parents/relations/[id]/route.ts (新建)
- src/app/api/v1/parents/children/route.ts (新建)
