## implement-school-apis: S1-S3 学校 API

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现学校管理 3 个接口：获取学校信息、更新学校、学校统计。仅 school_admin 可访问。

**DoD：**
实现类：
- [ ] `src/app/api/v1/schools/current/route.ts` 已创建（GET + PUT）
- [ ] `src/app/api/v1/schools/stats/route.ts` 已创建（GET）
- [ ] S1: GET /schools/current → 返回学校信息
- [ ] S2: PUT /schools/current → 更新学校名称/settings
- [ ] S3: GET /schools/stats → 返回老师数/学生数/班级数/家长数
测试类：
- [ ] 变更点测试：GET /schools/current as school_admin → 返回学校信息含 settings
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-school-service, implement-permission-guard

**回滚策略：** 删除 `src/app/api/v1/schools/` 目录

**影响的文件：**
- src/app/api/v1/schools/current/route.ts (新建)
- src/app/api/v1/schools/stats/route.ts (新建)
