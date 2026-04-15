## implement-student-apis: ST1-ST4 学生 API

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现学生管理 4 个接口。school_admin + teacher 可访问。

**DoD：**
实现类：
- [ ] `src/app/api/v1/classes/[classId]/students/route.ts` 已创建（GET 列表 + POST 添加）
- [ ] `src/app/api/v1/classes/[classId]/students/[studentId]/route.ts` 已创建（PUT 更新）
- [ ] `src/app/api/v1/students/[id]/route.ts` 已创建（GET 详情）
- [ ] ST1: GET /classes/:cid/students → 班级学生列表含 parentCount
- [ ] ST2: POST /classes/:cid/students → 添加学生（手机号）
- [ ] ST3: GET /students/:id → 学生详情含 classes + parents
- [ ] ST4: PUT /classes/:cid/students/:sid → 更新分组/状态
测试类：
- [ ] 变更点测试：POST /classes/:cid/students { phone, name } → 添加学生到班级
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-student-service, implement-permission-guard

**回滚策略：** 删除相关 route 文件

**影响的文件：**
- src/app/api/v1/classes/[classId]/students/route.ts (新建)
- src/app/api/v1/classes/[classId]/students/[studentId]/route.ts (新建)
- src/app/api/v1/students/[id]/route.ts (新建)
