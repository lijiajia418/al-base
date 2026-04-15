## implement-teacher-service: 老师管理服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现老师的添加（手机号匹配/创建）、列表、详情、编辑、状态管理。

**DoD：**
实现类：
- [ ] `src/domains/teacher/teacher-service.ts` 已创建
- [ ] `addTeacher(schoolId, phone, name, title?, subjects?)`: 手机号查重 → 创建/关联 user + teacher_profile
- [ ] `listTeachers(schoolId, filters)`: 分页、按状态/关键词筛选
- [ ] `getTeacher(userId)`: 详情含负责班级列表
- [ ] `updateTeacher(userId, data)`: 编辑姓名/职称/科目
- [ ] `updateTeacherStatus(userId, action)`: suspend/activate/resign
测试类：
- [ ] 变更点测试：addTeacher(phone, name) → 创建 user(roles=['teacher']) + teacher_profile
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-auth-interceptor

**回滚策略：** 删除 `src/domains/teacher/teacher-service.ts`

**影响的文件：**
- src/domains/teacher/teacher-service.ts (新建)
