# 追溯报告：F-002-user-system

## 设计 → 实现 → 测试 映射

| 设计文档 | 实现文件 | 测试文件 | 状态 |
|---------|---------|---------|------|
| api-design §2 Auth A1 | src/app/api/v1/auth/sms-code/route.ts | tests/app/api/v1/auth/sms-code.test.ts | 通过 |
| api-design §2 Auth A2 | src/app/api/v1/auth/login/route.ts | tests/app/api/v1/auth/login.test.ts | 通过 |
| api-design §2 Auth A3 | src/app/api/v1/auth/logout/route.ts | tests/app/api/v1/auth/logout.test.ts | 通过 |
| api-design §2 Auth A4 | src/app/api/v1/auth/me/route.ts | tests/app/api/v1/auth/me.test.ts | 通过 |
| api-design §2 Auth A5 | src/app/api/v1/auth/switch-role/route.ts | tests/app/api/v1/auth/switch-role.test.ts | 通过 |
| api-design §3 Users U1 | src/app/api/v1/users/profile/route.ts | tests/app/api/v1/users/profile.test.ts | 通过 |
| api-design §4 Schools S1-S3 | src/app/api/v1/schools/{current,stats}/route.ts | tests/app/api/v1/schools/schools.test.ts | 通过 |
| api-design §5 Teachers T1-T5 | src/app/api/v1/teachers/**/route.ts | tests/app/api/v1/teachers/teachers.test.ts | 通过 |
| api-design §6 Classes C1-C7 | src/app/api/v1/classes/**/route.ts | tests/app/api/v1/classes/classes.test.ts | 通过 |
| api-design §7 Students ST1-ST4 | src/app/api/v1/{classes,students}/**/route.ts | tests/app/api/v1/students/students.test.ts | 通过 |
| api-design §8 Parents P1-P4 | src/app/api/v1/{students,parents}/**/route.ts | tests/app/api/v1/parents/parents.test.ts | 通过 |
| api-design §9 Roles R1-R6 | src/app/api/v1/{teacher-roles,permissions}/**/route.ts | tests/app/api/v1/teacher-roles/teacher-roles.test.ts | 通过 |

## 中间件 → 测试 映射

| 设计文档 | 实现文件 | 测试文件 | 状态 |
|---------|---------|---------|------|
| user-system-design §2.4 认证拦截器 | src/lib/auth/auth-interceptor.ts | tests/lib/auth/auth-interceptor.test.ts | 通过 |
| user-system-design §2.4 角色解析 | src/lib/auth/role-injector.ts | tests/lib/auth/role-injector.test.ts | 通过 |
| user-system-design §5 权限校验 | src/lib/auth/permission-guard.ts | tests/lib/auth/permission-guard.test.ts | 通过 |

## Service → 测试 映射

| 设计文档 | 实现文件 | 测试文件 | 状态 |
|---------|---------|---------|------|
| user-system-design §2 认证 | src/domains/auth/sms-service.ts | tests/domains/auth/sms-service.test.ts | 通过 |
| user-system-design §2 Token | src/domains/auth/token-service.ts | tests/domains/auth/token-service.test.ts | 通过 |
| user-system-design §2 登录 | src/domains/auth/auth-service.ts | tests/domains/auth/auth-service.test.ts | 通过 |
| user-system-design §4 学校 | src/domains/school/school-service.ts | tests/domains/school/school-service.test.ts | 通过 |
| user-system-design §4 老师 | src/domains/teacher/teacher-service.ts | tests/domains/teacher/teacher-service.test.ts | 通过 |
| user-system-design §4 班级 | src/domains/class/class-service.ts | tests/domains/class/class-service.test.ts | 通过 |
| user-system-design §4 学生 | src/domains/student/student-service.ts | tests/domains/student/student-service.test.ts | 通过 |
| user-system-design §4 家长 | src/domains/parent/parent-service.ts | tests/domains/parent/parent-service.test.ts | 通过 |
| user-system-design §5 角色权限 | src/domains/permission/role-permission-service.ts | tests/domains/permission/role-permission-service.test.ts | 通过 |

## E2E 用户旅程映射

| 旅程 | 覆盖的 API | 测试文件 | 状态 |
|------|-----------|---------|------|
| 认证闭环 | A1→A2→A4→A5→A3 | tests/e2e/auth-flow.test.ts | 通过 |
| 组织管理 | T2→C2→ST2→P1→P4 | tests/e2e/org-management-flow.test.ts | 通过 |

## 覆盖率分析
- API 覆盖：35/35 (100%)
- Service 覆盖：9/9 (100%)
- 中间件覆盖：3/3 (100%)
- E2E 旅程：2 条核心流程

## 缺口
- 单个 API 的边界条件测试（空输入、并发、权限拒绝场景）→ Sprint 3 优化
- 手机号脱敏在返回中未统一应用 → CONCERN，后续优化
