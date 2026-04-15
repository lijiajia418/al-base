## implement-class-service: 班级管理服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现班级创建、列表、详情、编辑、归档，以及班级老师的分配/移除。

**DoD：**
实现类：
- [ ] `src/domains/class/class-service.ts` 已创建
- [ ] `createClass(schoolId, creatorId, data)`: 创建班级 + 自动将创建者加入 class_teachers
- [ ] `listClasses(schoolId, filters, teacherId?)`: 管理员看全校，老师只看自己的班
- [ ] `getClass(classId)`: 详情含 teachers 列表 + studentCount + groupSummary
- [ ] `updateClass(classId, data)`: 编辑名称/年级/阶段
- [ ] `updateClassStatus(classId, action)`: archive/activate
- [ ] `assignTeacher(classId, teacherId, teacherRoleId?)`: 分配老师到班级
- [ ] `removeTeacher(classId, teacherId)`: 移除班级老师
测试类：
- [ ] 变更点测试：teacher 创建班级 → classes 记录 + class_teachers 记录（creator 为该 teacher）
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-auth-interceptor

**回滚策略：** 删除 `src/domains/class/class-service.ts`

**影响的文件：**
- src/domains/class/class-service.ts (新建)
