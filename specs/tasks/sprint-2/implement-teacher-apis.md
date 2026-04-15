## implement-teacher-apis: T1-T5 老师 API

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现老师管理 5 个接口。仅 school_admin 可访问。

**DoD：**
实现类：
- [ ] `src/app/api/v1/teachers/route.ts` 已创建（GET 列表 + POST 添加）
- [ ] `src/app/api/v1/teachers/[id]/route.ts` 已创建（GET 详情 + PUT 编辑）
- [ ] `src/app/api/v1/teachers/[id]/status/route.ts` 已创建（PUT 停用/启用/离职）
- [ ] T1: GET /teachers → 分页列表，含 classCount
- [ ] T2: POST /teachers → 添加老师（手机号）
- [ ] T3: GET /teachers/:id → 详情含负责班级
- [ ] T4: PUT /teachers/:id → 编辑信息
- [ ] T5: PUT /teachers/:id/status → suspend/activate/resign
测试类：
- [ ] 变更点测试：POST /teachers { phone, name } → 创建老师，返回 201
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-teacher-service, implement-permission-guard

**回滚策略：** 删除 `src/app/api/v1/teachers/` 目录

**影响的文件：**
- src/app/api/v1/teachers/route.ts (新建)
- src/app/api/v1/teachers/[id]/route.ts (新建)
- src/app/api/v1/teachers/[id]/status/route.ts (新建)
