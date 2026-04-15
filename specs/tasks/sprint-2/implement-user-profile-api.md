## implement-user-profile-api: PUT /users/profile

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现更新个人信息接口（name/email）。

**DoD：**
实现类：
- [ ] `src/app/api/v1/users/profile/route.ts` 已创建
- [ ] PUT 接收 { name?, email? }，更新 users 表
- [ ] 返回更新后的用户数据
测试类：
- [ ] 变更点测试：PUT { name: "新名字" } → 返回更新后数据，name 已变更
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-me-api

**回滚策略：** 删除 `src/app/api/v1/users/profile/route.ts`

**影响的文件：**
- src/app/api/v1/users/profile/route.ts (新建)
