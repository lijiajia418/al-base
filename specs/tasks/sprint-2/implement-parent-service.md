## implement-parent-service: 家长管理服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现家长绑定（手机号匹配/创建）、查看学生的家长列表、更新绑定状态、家长查看自己绑定的孩子。

**DoD：**
实现类：
- [ ] `src/domains/parent/parent-service.ts` 已创建
- [ ] `addParent(studentId, phone, name?, relationType)`: 手机号查重 → 创建/关联 user + parent_profile + parent_student_relations(active)
- [ ] `listParents(studentId)`: 查看学生的家长列表
- [ ] `updateBinding(relationId, bindingStatus)`: 更新绑定状态（active/revoked）
- [ ] `listChildren(parentId)`: 家长查看自己绑定的孩子（binding_status=active）
- [ ] 校验 parent 手机号 ≠ student 手机号
测试类：
- [ ] 变更点测试：addParent(studentId, phone, 'father') → 创建 user(roles=['parent']) + parent_profile + parent_student_relations(active)
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-student-service

**回滚策略：** 删除 `src/domains/parent/parent-service.ts`

**影响的文件：**
- src/domains/parent/parent-service.ts (新建)
