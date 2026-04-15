# 代码审查报告：F-002-user-system

## 摘要
- 审查日期：2026-04-09
- 审查范围：Sprint 2（26 个 TASK，~50 个源文件）
- MUST-FIX：6 项（全部已修复）
- CONCERN：10 项
- POSITIVE：10 项

## 审查维度

### 1. 安全
| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| auth-interceptor.ts | Token 提取用 replace 可能被绕过 | MUST-FIX | 已修复（改为 slice(7)） |
| sms-service.ts | JSON.parse 无 try-catch，Redis 数据损坏时崩溃 | MUST-FIX | 已修复 |
| token-service.ts | JSON.parse 无 try-catch | MUST-FIX | 已修复 |
| teacher-service.ts | getTeacher 缺 schoolId 过滤（跨租户泄漏） | MUST-FIX | 已修复 |
| class-service.ts | getClass 缺 schoolId 过滤 | MUST-FIX | 已修复 |
| role-permission-service.ts | getRole 缺 schoolId 过滤 | MUST-FIX | 已修复 |
| 全部 ORM 查询 | 使用 Drizzle 参数化查询，无 SQL 注入风险 | POSITIVE | — |
| permission-guard.ts | parent 绑定校验包含 binding_status=active | POSITIVE | — |

### 2. 边界条件
| 文件 | 发现 | 分类 |
|------|------|------|
| role-injector.ts | 空 roles 数组导致 activeRole="" | CONCERN |
| auth-service.ts | 新用户 roles=[] 可登录但无角色 | CONCERN |
| auth-service.ts | 并发注册可能导致重复用户（query-then-insert 非原子） | CONCERN |

### 3. API 契约对齐
| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| teacher-service.ts | 列表缺 classCount 字段 | MUST-FIX | 已修复 |
| student-service.ts | 列表缺 parentCount 字段 | MUST-FIX | 已修复 |
| teacher-service.ts | keyword 过滤未实现 | MUST-FIX | 已修复 |
| 全部 API | 统一 { code, data, message } 格式 | POSITIVE | — |

### 4. 错误处理
| 文件 | 发现 | 分类 |
|------|------|------|
| permission-guard.ts | DB 查询无 try-catch | CONCERN |
| 全部 route handler | 错误码映射完整 | POSITIVE |

### 5. 依赖
| 发现 | 分类 |
|------|------|
| ioredis + drizzle-orm 版本锁定在 package-lock.json | POSITIVE |
| 无循环依赖 | POSITIVE |

### 6. 架构一致性
| 发现 | 分类 |
|------|------|
| route handler → service → DB 分层清晰 | POSITIVE |
| permission-guard.ts 动态 import schema 文件 | CONCERN |
| school-service.ts classCount 和 activeClassCount 相同 | MUST-FIX（已修复） |

### 7. 代码质量
| 发现 | 分类 |
|------|------|
| Service 命名清晰，职责单一 | POSITIVE |
| 响应格式没有统一的 phone 脱敏处理 | CONCERN |
| 分页无上限校验 | CONCERN |

### 8. 测试质量
| 发现 | 分类 |
|------|------|
| 80 个测试用例，每个 TASK 至少 1 个 | POSITIVE |
| 测试数据使用固定 UUID，afterAll 清理 | POSITIVE |
| 边界 Case 覆盖不足（如并发、空输入） | CONCERN |

## MUST-FIX 修复记录
| # | 维度 | 问题 | 修复方式 | 回归结果 |
|---|------|------|---------|---------|
| 1 | 安全 | Token 提取 replace 漏洞 | 改为 slice(7) | 80/80 通过 |
| 2 | 安全 | sms-service JSON.parse 无 try-catch | 加 try-catch，异常返回 CODE_EXPIRED | 80/80 通过 |
| 3 | 安全 | token-service JSON.parse 无 try-catch | 加 try-catch，异常返回 null | 80/80 通过 |
| 4 | 安全 | 3 个 detail 方法缺租户隔离 | 增加 schoolId 参数和过滤条件 | 80/80 通过 |
| 5 | 契约 | teacher 列表缺 classCount，student 缺 parentCount | 补充关联查询 | 80/80 通过 |
| 6 | 契约 | keyword 过滤 + activeClassCount 修复 | 实现 ilike 过滤 + 分开查询 | 80/80 通过 |

## 结论
通过。6 项 MUST-FIX 全部修复，回归测试 80/80 全量通过。10 项 CONCERN 标记为后续优化。
