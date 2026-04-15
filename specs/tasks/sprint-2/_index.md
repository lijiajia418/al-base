# Sprint 2

**状态**: in_progress
**Feature**: F-002-user-system
**目标**: 用户体系 MVP — 认证闭环 + 角色权限 + 组织管理 + 35 个 API

## 任务索引

| # | Task | 名称 | 来源 PBI | 层级 | 依赖 | 状态 |
|---|------|------|---------|------|------|------|
| 1 | setup-redis-client | Redis 客户端初始化 | user-system | SETUP | 无 | completed |
| 2 | setup-api-response | 统一响应格式和错误码 | user-system | SETUP | 无 | completed |
| 3 | implement-sms-service | 短信验证码服务 | user-system | DOMAIN | 1 | completed |
| 4 | implement-token-service | Token 会话服务 | user-system | DOMAIN | 1 | completed |
| 5 | implement-auth-service | 登录认证服务 | user-system | DOMAIN | 3, 4 | completed |
| 6 | implement-auth-interceptor | 认证拦截器中间件 | user-system | DOMAIN | 4 | completed |
| 7 | implement-role-injector | 角色解析中间件 | user-system | DOMAIN | 6 | completed |
| 8 | implement-permission-guard | 权限校验中间件 | user-system | DOMAIN | 7 | completed |
| 9 | implement-sms-code-api | POST /auth/sms-code | user-system | API | 3, 6 | completed |
| 10 | implement-login-api | POST /auth/login | user-system | API | 5, 6 | completed |
| 11 | implement-logout-api | POST /auth/logout | user-system | API | 4, 6 | completed |
| 12 | implement-me-api | GET /auth/me | user-system | API | 6 | completed |
| 13 | implement-switch-role-api | POST /auth/switch-role | user-system | API | 7 | completed |
| 14 | implement-school-service | 学校服务 | user-system | DOMAIN | 6 | completed |
| 15 | implement-teacher-service | 老师管理服务 | user-system | DOMAIN | 6 | completed |
| 16 | implement-class-service | 班级管理服务 | user-system | DOMAIN | 6 | completed |
| 17 | implement-student-service | 学生管理服务 | user-system | DOMAIN | 16 | completed |
| 18 | implement-parent-service | 家长管理服务 | user-system | DOMAIN | 17 | completed |
| 19 | implement-role-permission-service | 角色权限服务 | user-system | DOMAIN | 6 | completed |
| 20 | implement-user-profile-api | PUT /users/profile | user-system | API | 12 | completed |
| 21 | implement-school-apis | S1-S3 学校 API | user-system | API | 14, 8 | completed |
| 22 | implement-teacher-apis | T1-T5 老师 API | user-system | API | 15, 8 | completed |
| 23 | implement-class-apis | C1-C7 班级 API | user-system | API | 16, 8 | completed |
| 24 | implement-student-apis | ST1-ST4 学生 API | user-system | API | 17, 8 | completed |
| 25 | implement-parent-apis | P1-P4 家长 API | user-system | API | 18, 8 | completed |
| 26 | implement-role-permission-apis | R1-R6 角色权限 API | user-system | API | 19, 8 | completed |

## DoD（Definition of Done）

- [ ] 所有 26 个任务状态为 completed
- [ ] 35 个 API 全部可用
- [ ] 认证闭环测试通过（发码→登录→访问→登出）
- [ ] 权限校验测试通过（不同角色不同权限）
- [ ] 租户隔离测试通过（跨校不可见）
- [ ] 源文档已反哺更新
