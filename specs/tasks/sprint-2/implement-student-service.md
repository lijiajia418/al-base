## implement-student-service: 学生管理服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现学生添加到班级（手机号匹配/创建）、列表、详情、更新分组/状态。

**DoD：**
实现类：
- [ ] `src/domains/student/student-service.ts` 已创建
- [ ] `addStudent(classId, phone, name, grade?, targetScore?, examDate?, groupName?)`: 手机号查重 → 创建/关联 user + student_profile + class_students
- [ ] `listStudents(classId, filters)`: 分页、按分组/状态筛选，含 parentCount
- [ ] `getStudent(studentId)`: 详情含 classes 列表 + parents 列表
- [ ] `updateClassStudent(classId, studentId, data)`: 更新分组/状态（transferred/graduated）
测试类：
- [ ] 变更点测试：addStudent(classId, phone, name) → 创建 user(roles=['student']) + student_profile + class_students
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-class-service

**回滚策略：** 删除 `src/domains/student/student-service.ts`

**影响的文件：**
- src/domains/student/student-service.ts (新建)
