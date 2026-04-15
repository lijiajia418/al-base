## implement-school-service: 学校服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现学校信息查询、更新、统计服务，所有查询强制带 school_id 过滤（租户隔离）。

**DoD：**
实现类：
- [ ] `src/domains/school/school-service.ts` 已创建
- [ ] `getSchool(schoolId)`: 查询学校信息
- [ ] `updateSchool(schoolId, data)`: 更新学校名称/settings
- [ ] `getStats(schoolId)`: 统计老师数、学生数、班级数、家长数
- [ ] 所有查询强制带 WHERE school_id 条件
测试类：
- [ ] 变更点测试：getSchool(id) → 返回正确的学校数据含 settings
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-auth-interceptor

**回滚策略：** 删除 `src/domains/school/school-service.ts`

**影响的文件：**
- src/domains/school/school-service.ts (新建)
