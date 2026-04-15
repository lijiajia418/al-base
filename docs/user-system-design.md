# 用户体系系统设计

**版本**: v2.2
**日期**: 2026-04-09
**关联**: 产品文档 MVP v0.2 + 用户体系全景

---

## 一、设计范围与分层

### 1.1 本文档覆盖

用户体系的上层设计，服务于产品文档中所有涉及"人"的功能。三大核心模块：

| 模块 | 解决什么问题 |
|------|------------|
| **认证系统** | 用户是谁？怎么登录？会话如何管理？ |
| **角色管理** | 用户是什么身份？如何获得身份？身份如何流转？ |
| **权限系统** | 用户能做什么？能看到什么？边界在哪？ |

### 1.2 MVP 范围约束

| 约束 | 说明 |
|------|------|
| **手机号 = 唯一标识** | 所有用户（含学生）必须有独立手机号，不允许与家长共用，一个手机号对应一个账号 |
| **学校管理员 = 运营初始化** | MVP 不做管理员自助注册，由运营后台或数据库直接初始化 |
| **MVP 聚焦学校模式** | 家庭模式（school_id=NULL、家长创建学生、上传学校进度）整体推迟到 v2 |
| **家长端 = 只读看板** | MVP 家长只能查看孩子的学习进展、完成情况、风险提醒，不做任何写操作 |
| **老师端和家长端数据共存** | 老师产生的数据（任务、分层、风险）和家长看到的数据（进展、说明、建议）并行存在，不互斥 |

### 1.3 系统分层

```
┌─────────────────────────────────────────────────────────────────┐
│  表现层（UI / 客户端）                                            │
│  ── 本文档不涉及，后续单独设计 ──                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  接入层（API Gateway / Middleware Chain）                         │
│                                                                 │
│  限流 → 认证拦截器 → 角色解析 → 权限校验 → 业务路由                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  业务服务层                                                       │
│                                                                 │
│  AuthService    │ UserService     │ RoleService                  │
│  SchoolService  │ ClassService    │ InvitationService            │
│  StudentService │ ParentService   │ TeacherService               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  数据层                                                          │
│                                                                 │
│  PostgreSQL: users, *_profiles, classes, class_*, invitations    │
│  Redis: sessions, sms_codes, rate_limits                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 产品功能 → 用户体系映射

> 以下列出产品文档所有涉及用户体系的功能点，标注对应的设计章节。

| 产品功能 | 涉及角色 | 用户体系关注点 | 对应章节 |
|---------|---------|-------------|---------|
| 老师注册/登录 | teacher | 认证、角色分配 | 二、三 |
| 创建班级 | teacher, school_admin | 组织管理、权限 | 四、五 |
| 导入学生名单 | teacher | 批量用户创建、角色分配 | 三、六 |
| 初始分层 | teacher | 数据写权限 | 五 |
| 任务编排与布置 | teacher | 资源归属校验（只能给自己班级布置） | 五 |
| 学生执行训练 | student | 认证、数据只读自己 | 二、五 |
| 查看班级/个体进展 | teacher | 数据可见性（自己班级） | 五 |
| 风险学生识别 | teacher, school_admin | 跨班级可见性 | 五 |
| 家长查看进展 | parent | 数据可见性（绑定的孩子） | 五 |
| 家长支持建议 | parent | 只读权限 | 五 |
| ~~家庭模式注册~~ | ~~parent~~ | ~~无学校用户创建、角色分配~~ | ~~v2 规划~~ |
| ~~上传学校进度~~ | ~~parent (家庭模式)~~ | ~~数据写权限~~ | ~~v2 规划~~ |
| 邀请老师/学生/家长 | school_admin, teacher | 邀请体系 | 六 |
| 家长绑定学生 | parent | 关系管理 | 六 |
| 老师同时是家长 | teacher+parent | 多角色、角色切换 | 三 |
| 角色切换 | 多角色用户 | 会话管理、视图隔离 | 二、三 |
| 生成家长阶段说明 | teacher | 跨角色数据推送 | 五 |
| 冲刺组管理 | teacher | 班级内分组权限 | 五 |
| 学校/班级设置 | school_admin, teacher | 配置权限 | 五 |
| 评分口径设置 | school_admin | 学校级配置权限 | 五 |
| 老师管理 | school_admin | 用户管理权限 | 四、五 |
| ~~家庭版邀请老师接入~~ | ~~parent~~ | ~~跨模式迁移~~ | ~~v2 规划~~ |

---

## 二、认证系统

### 2.1 认证方式

MVP 采用 **手机号 + 短信验证码** 作为唯一登录方式。

| 决策 | 理由 |
|------|------|
| 不用密码 | 老师/家长群体对验证码最熟悉，免密码管理和找回 |
| 不用微信登录 | 老师端需要在 PC 浏览器使用，微信登录受限 |
| 不用邮箱 | 学生群体邮箱使用率低 |
| 手机号 = 唯一账号标识 | 一个手机号对应一个账号，所有角色（含学生）必须有独立手机号，不允许与家长共用 |
| 手机号做管理标识 | 老师添加/导入学生时通过手机号匹配，手机号是跨角色的用户唯一键 |
| 预留密码字段 | `password_hash` 可空，未来可扩展密码登录 |

### 2.2 认证流程

#### 2.2.1 发送验证码

```
POST /api/auth/sms-code
{ phone: "13800001234" }

服务端处理：
  1. 校验手机号格式
  2. 检查频率限制（Redis sms:limit:{phone}，每日 ≤ 10 次）
  3. 检查发送间隔（Redis sms:cooldown:{phone}，60秒内不可重发）
  4. 检查是否被锁定（Redis sms:lock:{phone}）
  5. 生成 6 位随机码
  6. 存入 Redis: sms:code:{phone} → { code, attempts: 0 }，TTL 5分钟
  7. 调用短信服务商 API 发送
  8. 递增每日计数 sms:limit:{phone}
  9. 设置冷却 sms:cooldown:{phone}，TTL 60秒
```

#### 2.2.2 验证码登录

```
POST /api/auth/login
{ phone: "13800001234", code: "123456" }

服务端处理：
  1. 读取 Redis sms:code:{phone}
  2. 不存在 → 返回 EXPIRED
  3. attempts ≥ 5 → 锁定手机号 30 分钟，返回 LOCKED
  4. code 不匹配 → attempts + 1，返回 WRONG_CODE
  5. code 匹配 → 删除 sms:code:{phone}
  6. 查询 users 表（WHERE phone = ?）
     a. 存在 → 取出用户，更新 last_login_at
     b. 不存在 → 创建用户（roles = []，无角色新用户）
  7. 生成 session → 存入 Redis（见 2.3）
  8. 返回 { token, user: { id, name, phone, roles, schoolId } }
```

#### 2.2.3 登录后路由决策

```
登录成功，返回 user 对象，客户端根据 roles 决定去向：

roles = []           → 新用户引导（输入邀请码）
roles = ['student']  → 学生首页
roles = ['parent']   → 家长首页
roles = ['teacher']  → 老师首页
roles = ['school_admin'] → 管理员后台
roles 多个           → 角色选择页（记住上次选择）
```

### 2.3 会话管理（Token）

#### 选型：Opaque Token + Redis

不使用 JWT，采用不透明令牌 + 服务端存储：

| 对比 | JWT | Opaque Token（选用） |
|------|-----|---------------------|
| 吊销 | 需黑名单，延迟生效 | 删 Redis key，即时生效 |
| 大小 | 大（含 payload） | 短（UUID） |
| 状态 | 无状态 | 有状态 |
| 角色变更 | 需重签 Token | 直接改 Redis |
| 适合 | 微服务间 | 单体 / BFF |

关键优势：用户角色变更（如被邀请成为老师）后，无需重新登录即可生效。

#### Token 数据结构

```
Token 值: UUID v4（如 "a3f8c2e1-4b5d-..."）
客户端传递: Authorization: Bearer {token}

Redis 存储:
  key:   "session:{tokenValue}"
  value: {
    userId:     "U001",
    phone:      "138****1234",
    roles:      ["teacher", "parent"],
    schoolId:   "S001",               // MVP 阶段所有用户都属于学校
    activeRole: "teacher",            // 当前激活角色
    deviceInfo: "Chrome/Mac",         // 设备信息（审计用）
    createdAt:  "2026-04-07T10:00:00Z",
    lastActiveAt: "2026-04-07T15:30:00Z"
  }
  TTL: 7 天
```

#### Token 生命周期

| 事件 | 处理 |
|------|------|
| 登录成功 | 生成新 Token，存入 Redis，TTL = 7天 |
| 正常请求 | 读取 session，更新 lastActiveAt |
| 即将过期（剩余 < 1天） | 自动续期到 7天（滑动窗口） |
| 主动登出 | 删除 Redis key |
| 角色变更 | 更新 Redis session 中的 roles 字段（无需重新登录） |
| 切换角色 | 更新 Redis session 中的 activeRole 字段 |
| 账号停用 | 删除该用户所有 session key |

#### 多设备策略

MVP 阶段允许多设备同时登录（同一用户可有多个 Token）。如需单设备：

```
Redis 增加索引: user_sessions:{userId} → Set<tokenValue>
登录时清除该集合中所有旧 Token
```

### 2.4 接入层中间件链

请求经过的中间件顺序：

```
请求 → ① 限流 → ② 认证拦截器 → ③ 角色解析 → ④ 权限校验 → ⑤ 业务路由
```

#### ① 限流（Rate Limiter）

| 维度 | 限制 |
|------|------|
| IP | 100 次/分钟（通用） |
| 手机号（验证码接口） | 1 次/60秒，10 次/天 |
| Token（已登录用户） | 300 次/分钟 |

#### ② 认证拦截器（Auth Interceptor）

职责：验证 Token，注入用户上下文。

```
白名单路由（不需要 Token）：
  /api/auth/sms-code      发送验证码
  /api/auth/login          登录
  /api/health              健康检查
  /api/invitations/verify  验证邀请码（匿名可查）

其他所有 /api/* 路由必须携带有效 Token。

处理流程：
  1. 提取 Authorization header
  2. 无 Token → 401 NO_TOKEN
  3. Redis 查 session:{token}
  4. 不存在 → 401 TOKEN_EXPIRED
  5. 存在 → 注入 req.auth = { userId, roles, schoolId, activeRole, ... }
  6. 更新 lastActiveAt，必要时续期
```

#### ③ 角色解析（Role Injector）

职责：确定本次请求使用哪个角色视角。

```
读取优先级：
  1. 请求 header X-Active-Role（客户端显式指定）
  2. session 中 activeRole（上次选择）
  3. roles[0]（默认第一个角色）

校验：
  requested role ∈ user.roles → 通过
  否则 → 403 ROLE_NOT_ASSIGNED
```

#### ④ 权限校验（Permission Guard）

职责：判断当前角色是否有权执行当前操作。详见第五章。

```
可以是路由级声明式：
  @RequireRole('teacher')
  @RequirePermission('manage_class')

也可以是资源级动态校验：
  该老师是否属于该班级？该家长是否绑定了该学生？
```

### 2.5 安全措施汇总

| 类别 | 措施 | 说明 |
|------|------|------|
| 验证码 | 60秒冷却 | 防止短信轰炸 |
| 验证码 | 每日 10 次上限 | 控制成本 |
| 验证码 | 5次错误锁定 30 分钟 | 防暴力破解 |
| 验证码 | 使用后立即销毁 | 防重放 |
| Token | 服务端存储 | 支持即时吊销 |
| Token | 7天滑动过期 | 活跃用户不掉线 |
| 传输 | 全站 HTTPS | 防中间人 |
| 日志 | 手机号脱敏 | 138****1234 |
| 账号 | 停用后清除所有 session | 即时生效 |

### 2.6 Redis Key 规划

```
# 验证码相关
sms:code:{phone}        → { code, attempts }           TTL 5min
sms:cooldown:{phone}    → 1                            TTL 60s
sms:limit:{phone}       → count                        TTL 到当日 24:00
sms:lock:{phone}        → 1                            TTL 30min

# 会话相关
session:{tokenValue}    → { userId, phone, roles, schoolId, activeRole, ... }  TTL 7天
user_sessions:{userId}  → Set<tokenValue>              TTL 7天（可选，多设备管理用）

# 限流相关
rate:ip:{ip}            → count                        TTL 1min
rate:token:{token}      → count                        TTL 1min
```

---

## 三、角色管理

### 3.1 角色定义

系统共 4 种角色，支持一人多角色：

| 角色 | 标识 | 定位 | 来源 |
|------|------|------|------|
| 学校管理员 | `school_admin` | 学校最高管理者，管理老师和班级 | **运营后台 / 数据库初始化**（MVP 不做自助注册） |
| 老师 | `teacher` | 教学执行者，管理班级和学生训练 | 管理员邀请 |
| 学生 | `student` | 训练执行者，**必须有独立手机号** | 老师导入 / 邀请码注册 |
| 家长 | `parent` | 进展观察者和支持者，**MVP 只读** | 老师邀请 |

### 3.2 角色与 Profile 关系

```
统一用户表 users:
  id, phone, name, roles[], school_id, status, ...

角色扩展表（1:1，按需创建）：
  user.roles 包含 'teacher'      → teacher_profiles  { user_id, title, subjects[], employment_status }
  user.roles 包含 'student'      → student_profiles  { user_id, grade, target_score, exam_date, tier, tier_labels, risk_labels }
  user.roles 包含 'parent'       → parent_profiles   { user_id, relation_type, notification_prefs }
  user.roles 包含 'school_admin' → 无额外表（管理员信息 user 表已够）
```

一人多角色示例（老师同时是家长）：

```
users:              { id: 'U001', roles: ['teacher', 'parent'], school_id: 'S001' }
teacher_profiles:   { user_id: 'U001', title: 'IELTS老师', subjects: ['IELTS'] }
parent_profiles:    { user_id: 'U001', relation_type: 'mother' }
class_teachers:     { teacher_id: 'U001', class_id: 'C001' }           ← 她教的班
parent_student_rel: { parent_id: 'U001', student_id: 'U008' }         ← 她孩子
```

### 3.3 角色获取方式

每种角色通过不同途径获得：

| 角色 | 获取方式 | 触发条件 |
|------|---------|---------|
| school_admin | 运营后台 / 数据库初始化 | 学校入驻时由运营创建 |
| teacher | 管理员生成邀请码 → 老师注册填码 | 使用 target_role='teacher' 的邀请码 |
| teacher | 管理员后台直接添加（输入手机号） | 管理员操作 |
| student | 老师手动添加（输入姓名+手机号） | 老师操作，系统创建用户，**手机号必填且独立** |
| student | 老师批量导入（Excel） | 老师操作，系统批量创建，**手机号必填且独立** |
| student | 班级邀请码 → 学生自行注册 | 使用 target_role='student' 的邀请码 |
| parent | 老师为学生生成家长邀请 → 家长注册 | 使用 target_role='parent' 的邀请码，同时建立 parent_student_relation |

> **v2 规划**：家庭模式（家长自助创建学生、自行注册）推迟到 v2。

### 3.4 角色分配流程

#### 场景 A：通过邀请码获得角色

```
邀请码使用流程：

  1. 用户登录（手机号验证码）
  2. 用户输入邀请码
  3. 系统查 invitations 表
  4. 校验：未过期、未用完、状态有效
  5. 读取 target_role
  6. 将 target_role 追加到 user.roles[]
  7. 按 target_role 创建对应 profile（如 teacher_profiles）
  8. 如果邀请码包含 target_class_id → 建立 class_teachers 或 class_students 关系
  9. 如果邀请码包含 target_student_id（家长邀请）→ 建立 parent_student_relations
  10. 更新 invitations.used_count
  11. 更新用户 session 中的 roles（无需重新登录）
```

#### 场景 B：老师导入学生（被动创建）

```
老师导入学生流程：

  1. 老师提交学生信息 { name, phone, grade, target_score, exam_date }
  2. 系统查 users WHERE phone = ?
     a. 不存在 → 创建 user（roles=['student'], status='pending_activation'）
     b. 存在但无 student 角色 → 追加 'student' 到 roles
     c. 已是 student → 跳过创建
  3. 创建/更新 student_profiles
  4. 创建 class_students 关系
  5. 发短信通知学生（含登录链接）

  学生首次登录时 status 从 pending_activation → active
```

#### 场景 C：家庭模式（v2 规划，MVP 不实现）

> 家庭模式（家长自助创建学生、school_id=NULL、上传学校进度、邀请老师接入）整体推迟到 v2。
> MVP 阶段所有用户都通过学校模式入口，家长只能通过老师邀请加入。

### 3.5 角色切换

多角色用户需要在不同视角间切换：

```
切换机制：
  1. 客户端发送 POST /api/auth/switch-role { role: 'parent' }
  2. 服务端校验 role ∈ user.roles
  3. 更新 Redis session 中 activeRole
  4. 返回成功

切换后的影响：
  - 后续所有请求的权限判断基于 activeRole
  - 数据可见性边界随角色变化（详见第五章）
  - 客户端导航菜单、首页内容随角色变化

不需要重新登录，不需要重新签发 Token。
```

### 3.6 角色生命周期

| 角色 | 生命周期状态 | 状态流转 |
|------|------------|---------|
| school_admin | active / suspended | 平台操作 |
| teacher | pending_activation → active → resigned | 邀请 → 首次登录 → 离职 |
| student | pending_activation → active → graduated / transferred | 导入 → 首次登录 → 毕业/转校 |
| parent | pending → active → revoked | 邀请 → 绑定确认 → 解绑 |

**角色不物理删除**，通过状态字段管理：

```
老师离职：teacher_profiles.employment_status = 'resigned'
  → 不删除 user，不删除 roles 中的 'teacher'
  → 该老师的历史数据（班级、任务）保留可查

学生毕业：class_students.status = 'graduated'
  → user.status = 'inactive'
  → 历史训练数据保留

家长解绑：parent_student_relations.binding_status = 'revoked'
  → 家长看不到该学生数据
  → 但绑定记录保留（审计追溯）
```

---

## 四、组织管理

### 4.1 学校（租户）

学校是数据隔离的顶层边界：

```
schools:
  id          UUID 主键
  name        学校名称
  code        学校唯一识别码
  settings    JSONB（评分口径、提醒规则、学校级配置）
  status      active / suspended
  created_at  创建时间

隔离规则：
  - 所有业务数据（班级、学生、任务、训练记录）在 school_id 下隔离
  - 用户查询必须带 school_id 条件（中间件自动注入）
  - MVP 阶段所有用户都属于学校，school_id 不为 NULL（v2 家庭模式时放开）
```

### 4.2 班级

班级是老师管理学生的核心组织单元：

```
classes:
  id            UUID
  school_id     FK → schools
  name          班级名称（"Year 12 IELTS A班"）
  grade         年级（Year 12 / Year 13）
  academic_year 学年（2025-2026）
  stage         阶段（foundation / intensive / sprint）
  status        active / archived
  created_by    FK → users（创建人）
  created_at    创建时间

班级内分组（通过 class_students.group_name）：
  - 冲刺组 / A组 / B组 等
  - 分组 ≠ 分层：分组是管理单元，分层是能力标签
  - 老师可按组批量布置任务
```

### 4.3 组织关系

```
class_teachers（老师 ↔ 班级，N:M）：
  class_id       FK → classes
  teacher_id      FK → users
  teacher_role_id FK → teacher_roles（班级内角色，覆盖全局默认）
  joined_at       加入时间

  一个老师可教多个班，一个班可有多个老师。
  班级内角色通过 teacher_role_id 引用 teacher_roles 表，不硬编码枚举值。

class_students（学生 ↔ 班级，N:M）：
  class_id       FK → classes
  student_id     FK → users
  group_name     班内分组（可空）
  status         active / transferred / graduated
  joined_at      加入时间

  一个学生可在多个班（如同时上 IELTS 和 EAL），一个班有多个学生。

parent_student_relations（家长 ↔ 学生，N:M）：
  parent_id      FK → users
  student_id     FK → users
  relation_type  father / mother / guardian
  binding_status pending / active / revoked
  permissions[]  该家长对该学生的可见范围（预留）
  created_at     创建时间

  一个家长可绑定多个孩子，一个孩子可被多个家长（父母）绑定。
```

### 4.4 组织管理功能清单

#### 学校管理员能力

| 功能 | 说明 |
|------|------|
| 邀请老师 | 生成邀请码 / 直接添加（手机号） |
| 管理老师 | 查看列表、编辑信息、停用/启用 |
| 创建班级 | 设置名称、年级、学年、阶段 |
| 配置班级老师 | 分配主讲/助教 |
| 查看全校学生 | 跨班级视角 |
| 查看全校统计 | 班级数、学生数、老师数 |
| 管理邀请 | 查看所有邀请码状态 |
| 学校设置 | 评分口径、提醒规则 |

#### 老师能力

| 功能 | 说明 |
|------|------|
| 添加学生 | 手动 / 批量导入 / 生成邀请码 |
| 管理学生 | 查看详情、调整分层、分组 |
| 邀请家长 | 为学生生成家长邀请 |
| 管理班级分组 | 创建/调整组（冲刺组等） |
| 查看班级 | 仅自己负责的班级 |
| 班级设置 | 班级级别的配置 |

#### 家长能力（MVP：只读看板）

| 功能 | 说明 |
|------|------|
| 绑定孩子 | 通过老师发出的邀请码（唯一写操作） |
| 查看孩子进展 | 仅绑定的孩子，包括训练完成情况、当前重点 |
| 查看阶段说明 | 老师生成的说明 |
| 查看支持建议 | 系统生成的家长建议 |
| 查看风险提醒 | 孩子的风险信息 |

> **v2 规划**：家庭模式能力（创建学生、上传学校进度、邀请老师接入）推迟到 v2。

---

## 五、权限系统

### 5.1 权限模型：三层判定

```
第一层：身份角色（Identity Role）
  users.roles → 当前 activeRole 是什么？
  school_admin / teacher / student / parent
  → 代码中路由映射，决定能否进入该接口

第二层：职能权限（Functional Permission）— 仅 teacher
  teacher_profiles.teacher_role_id → 全局操作（scope=global）
  class_teachers.teacher_role_id   → 班级操作（scope=class）
  → 查 teacher_role_permissions + permissions 表，数据库驱动

第三层：资源归属（Resource Ownership）
  该老师是否属于该班级？该家长是否绑定了该学生？
  → 查关系表（class_teachers / parent_student_relations）
```

### 5.2 权限判定链路

```
请求到达
  │
  ├─ 提取 activeRole
  │
  ├─ 第一层：身份角色检查（代码路由映射）
  │   school_admin → 放行所有管理操作
  │   student → 只能访问自己的数据
  │   parent → 只能查看绑定孩子的数据
  │   teacher → 进入第二层
  │   不匹配 → 403 ROLE_NOT_ALLOWED
  │
  ├─ 第二层：职能权限检查（仅 teacher，查数据库）
  │   scope=global 的操作（如创建班级）：
  │     查 teacher_profiles.teacher_role_id → role_permissions → 有该权限？
  │   scope=class 的操作（如布置任务）：
  │     查 class_teachers.teacher_role_id → role_permissions → 有该权限？
  │     （teacher_role_id 为空时回退到 teacher_profiles.teacher_role_id）
  │   无权限 → 403 PERMISSION_DENIED
  │
  └─ 第三层：资源归属检查
      teacher → 该班级在 class_teachers 中有记录？
      student → user_id = 自己？
      parent → parent_student_relations 中 binding_status = 'active'？
      不通过 → 403 RESOURCE_NOT_ACCESSIBLE
```

### 5.3 权限体系数据结构

权限相关 3 张表（角色和权限都是数据，不是代码硬编码）：

```
teacher_roles（老师职能角色定义，每个学校独立维护）：
  id, school_id, name, code, description, is_system, status

permissions（权限定义，系统预置 14 条）：
  id, code, name, scope(global/class), category, sort_order

teacher_role_permissions（角色-权限映射，后台可配置）：
  id, teacher_role_id, permission_id
```

**预置权限清单（14 条）**：

| 权限编码 | 名称 | 作用域 | 分类 |
|---------|------|--------|------|
| class:create | 创建班级 | global | class |
| class:archive | 归档班级 | global | class |
| class:assign_teacher | 分配班级老师 | global | class |
| class:edit | 编辑班级信息 | class | class |
| student:add | 添加学生 | class | student |
| student:view | 查看学生 | class | student |
| student:edit | 编辑学生信息 | class | student |
| student:remove | 移除学生 | class | student |
| parent:add | 添加家长 | class | parent |
| parent:view | 查看家长 | class | parent |
| task:assign | 布置任务 | class | task |
| task:view | 查看任务 | class | task |
| report:school | 查看全校报表 | global | report |
| report:class | 查看班级报表 | class | report |

### 5.4 各角色权限判定方式

| 角色 | 权限来源 | 判定方式 |
|------|---------|---------|
| school_admin | 代码路由映射 | 全部放行（管理员拥有所有管理权限） |
| teacher | **数据库配置** | 查 teacher_roles → teacher_role_permissions → permissions |
| student | 代码路由映射 | 只能访问 user_id = 自己 的数据 |
| parent | 代码路由映射 | 只能查看 binding_status = 'active' 的孩子数据（MVP 只读） |

### 5.5 teacher 权限判定示例

**张老师**：全局角色 = 主讲老师，在 A 班是主讲，在 B 班是助教

```
主讲老师的权限：class:create, class:edit, student:add, student:view, student:edit, task:assign, task:view, report:class, parent:add, parent:view
助教老师的权限：student:view, task:view, report:class, parent:view
```

| 操作 | 判定过程 | 结果 |
|------|---------|------|
| 创建班级 | 身份=teacher ✓ → scope=global，查全局角色"主讲老师"，有 class:create ✓ | 放行 |
| 给 A 班布置任务 | 身份=teacher ✓ → scope=class，查 A 班角色"主讲老师"，有 task:assign ✓ → A 班在 class_teachers ✓ | 放行 |
| 给 B 班布置任务 | 身份=teacher ✓ → scope=class，查 B 班角色"助教老师"，无 task:assign ✗ | 拒绝 |
| 查看 B 班学生 | 身份=teacher ✓ → scope=class，查 B 班角色"助教老师"，有 student:view ✓ → B 班在 class_teachers ✓ | 放行 |

### 5.6 数据可见性规则

每个角色看到的数据有明确边界：

#### school_admin 数据边界

```sql
WHERE school_id = 当前用户的 school_id
```

#### teacher 数据边界

```sql
-- 只看到自己班级的学生
WHERE student_id IN (
  SELECT student_id FROM class_students
  WHERE class_id IN (
    SELECT class_id FROM class_teachers WHERE teacher_id = 当前老师
  )
  AND status = 'active'
)
```

#### student 数据边界

```sql
WHERE user_id = 当前学生
```

#### parent 数据边界

```sql
WHERE student_id IN (
  SELECT student_id FROM parent_student_relations
  WHERE parent_id = 当前家长 AND binding_status = 'active'
)
```

### 5.7 跨角色数据流动

| 场景 | 数据流向 | 权限要求 |
|------|---------|---------|
| 老师布置任务 → 学生看到任务 | teacher → student | teacher 有 task:assign 权限 |
| 学生提交训练 → 老师看到结果 | student → teacher | 自动流转，通过班级关系 |
| 老师生成家长说明 → 家长查看 | teacher → parent | teacher 有 student:view + parent 绑定了该学生 |
| 系统识别风险 → 老师+家长看到 | system → teacher, parent | 通过班级关系和绑定关系 |
| ~~家长上传学校进度 → AI 处理~~ | ~~parent → system~~ | ~~v2 家庭模式~~ |
| ~~家庭模式邀请老师 → 老师接入~~ | ~~parent → teacher~~ | ~~v2 家庭模式~~ |

---

## 六、用户获取与关系建立

> **注**：原邀请码机制是设计推测，产品文档未明确定义用户获取方式。本章仅描述已确认的用户关系建立方式，具体获取机制（邀请码/短信链接/管理员直接添加等）待业务需求确定后补充。

### 6.1 已确认的用户获取方式

| 角色 | 获取方式 | 说明 |
|------|---------|------|
| school_admin | 运营后台 / 数据库初始化 | MVP 不做自助注册 |
| teacher | 管理员在后台添加（输入手机号） | 老师用手机号登录即激活 |
| student | 老师手动添加 / 批量导入 | 输入姓名 + 手机号，系统创建用户 |
| parent | 老师为学生添加家长 | 输入家长手机号 + 关系，系统创建绑定 |

### 6.2 关系建立流程

#### 管理员添加老师

```
1. 管理员输入老师手机号和姓名
2. 系统查 users WHERE phone = ?
   a. 不存在 → 创建 user（roles=['teacher'], status='pending_activation'）
   b. 存在 → 追加 'teacher' 到 roles
3. 创建 teacher_profiles
4. 老师首次登录时 status → active
```

#### 老师添加学生

```
方式 A：手动添加
  1. 老师输入学生信息（姓名 + 手机号 + 年级 + 目标分 + 考试时间）
  2. 系统创建/关联 user + student_profile + class_students

方式 B：批量导入
  1. 老师下载 Excel 模板
  2. 填写学生信息，上传
  3. 系统批量处理，返回导入结果
```

#### 老师为学生添加家长

```
1. 老师输入家长手机号和关系（父亲/母亲/监护人）
2. 系统创建/关联 user（roles 追加 'parent'）+ parent_profile
3. 创建 parent_student_relations（binding_status = 'active'）
```

### 6.3 待确定事项

| 事项 | 待定原因 |
|------|---------|
| 邀请码机制 | 产品文档未提到，需求不确定 |
| 学生自行注册入班 | 是否需要学生主动注册？还是只能老师导入？ |
| 家长自行绑定 | 是否需要家长自行操作？还是只能老师代为添加？ |
| 短信通知 | 添加用户后是否发短信通知？ |

---

## 七、数据库设计

> 数据库：PostgreSQL，ORM：Drizzle，Schema：public
> 共 12 张表，4 层结构：组织层(1) → 用户层(4) → 关系层(4) → 权限层(3)
> **设计原则**：不设置外键约束，引用完整性由应用层保证。所有关联字段保留逻辑关系注释但不建 FK。
> 完整 DDL 详见 `docs/database-schema.md`。本节仅列出表结构概要。

### 7.1 schools — 学校（租户）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| name | varchar(100) | NOT NULL | — | 学校名称 |
| code | varchar(20) | NOT NULL, UNIQUE | — | 学校唯一识别码 |
| settings | jsonb | NOT NULL | '{}' | 学校级配置（评分口径、提醒规则等） |
| status | varchar(20) | NOT NULL | 'active' | active / suspended |
| created_at | timestamptz | NOT NULL | now() | 创建时间 |
| updated_at | timestamptz | NOT NULL | now() | 更新时间 |

**索引**：
```sql
CREATE UNIQUE INDEX idx_schools_code ON schools(code);
```

**约束**：
```sql
ALTER TABLE schools ADD CONSTRAINT chk_schools_status
  CHECK (status IN ('active', 'suspended'));
```

---

### 7.2 users — 统一用户表

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| school_id | uuid | NOT NULL | — | 所属学校（逻辑关联 schools.id） |
| phone | varchar(20) | NOT NULL, UNIQUE | — | 手机号，唯一登录标识，每人独立 |
| email | varchar(255) | UNIQUE | — | 邮箱（预留） |
| name | varchar(50) | NOT NULL | — | 姓名 |
| avatar_url | text | — | — | 头像 URL |
| roles | text[] | NOT NULL | '{}'::text[] | 角色数组，值域：school_admin / teacher / student / parent |
| status | varchar(20) | NOT NULL | 'active' | active / pending_activation / inactive / suspended |
| password_hash | varchar(255) | — | — | 预留密码字段，MVP 不使用 |
| last_login_at | timestamptz | — | — | 最后登录时间 |
| created_by | uuid | — | — | 创建人（逻辑关联 users.id，老师导入学生时记录） |
| created_at | timestamptz | NOT NULL | now() | 创建时间 |
| updated_at | timestamptz | NOT NULL | now() | 更新时间 |

**索引**：
```sql
CREATE UNIQUE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_roles ON users USING GIN(roles);
CREATE INDEX idx_users_status ON users(status);
```

**约束**：
```sql
ALTER TABLE users ADD CONSTRAINT chk_users_phone_format
  CHECK (phone ~ '^\d{11}$');
ALTER TABLE users ADD CONSTRAINT chk_users_status
  CHECK (status IN ('active', 'pending_activation', 'inactive', 'suspended'));
```

**设计说明**：
- 所有角色共用一张表，避免多表 JOIN，登录认证只查一张表
- roles 用 text[]：Drizzle 一等公民支持，有类型化操作符（arrayContains 等）
- 一人可多角色（如 ['teacher','parent']），角色切换是前端行为
- phone 必须独立，学生不允许与家长共用手机号

---

### 7.3 teacher_profiles — 老师扩展（1:1 → users）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| user_id | uuid | NOT NULL, UNIQUE | — | 关联用户（逻辑关联 users.id） |
| teacher_role_id | uuid | — | — | 全局默认职能角色（逻辑关联 teacher_roles.id） |
| title | varchar(50) | — | — | 职称：IELTS老师 / EAL老师 / 年级负责人 |
| subjects | text[] | NOT NULL | '{}'::text[] | 教授科目：IELTS / EAL / English 等 |
| employment_status | varchar(20) | NOT NULL | 'active' | active / resigned |
| created_at | timestamptz | NOT NULL | now() | 创建时间 |
| updated_at | timestamptz | NOT NULL | now() | 更新时间 |

---

### 7.4 student_profiles — 学生扩展（1:1 → users）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| user_id | uuid | NOT NULL, UNIQUE | — | 关联用户（逻辑关联 users.id） |
| grade | varchar(20) | — | — | 年级：Year 12 / Year 13 |
| target_score | decimal(3,1) | — | — | 雅思目标分（如 6.5, 7.0） |
| exam_date | date | — | — | 预计考试时间 |
| created_at | timestamptz | NOT NULL | now() | 创建时间 |
| updated_at | timestamptz | NOT NULL | now() | 更新时间 |

> **注**：分层字段（tier, tier_labels, risk_labels）属于业务能力，不在基础用户体系中设计，后续业务迭代时扩展此表。

**索引**：
```sql
CREATE UNIQUE INDEX idx_student_profiles_user ON student_profiles(user_id);
```

**约束**：
```sql
ALTER TABLE student_profiles ADD CONSTRAINT chk_student_target_score
  CHECK (target_score IS NULL OR (target_score >= 0 AND target_score <= 9));
```

---

### 7.5 parent_profiles — 家长扩展（1:1 → users）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| user_id | uuid | NOT NULL, UNIQUE | — | 关联用户（逻辑关联 users.id） |
| relation_type | varchar(20) | — | — | 默认关系类型：father / mother / guardian |
| created_at | timestamptz | NOT NULL | now() | 创建时间 |
| updated_at | timestamptz | NOT NULL | now() | 更新时间 |

> **注**：通知偏好（notification_prefs）属于业务能力，后续迭代时扩展此表。

**索引**：
```sql
CREATE UNIQUE INDEX idx_parent_profiles_user ON parent_profiles(user_id);
```

---

### 7.6 classes — 班级

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| school_id | uuid | NOT NULL | — | 所属学校（逻辑关联 schools.id） |
| name | varchar(100) | NOT NULL | — | 班级名称（"Year 12 IELTS A班"） |
| grade | varchar(20) | — | — | 年级 |
| academic_year | varchar(20) | — | — | 学年（2025-2026） |
| stage | varchar(20) | — | — | 阶段：foundation / intensive / sprint |
| status | varchar(20) | NOT NULL | 'active' | active / archived |
| created_by | uuid | NOT NULL | — | 创建人（逻辑关联 users.id） |
| created_at | timestamptz | NOT NULL | now() | 创建时间 |
| updated_at | timestamptz | NOT NULL | now() | 更新时间 |

**索引**：
```sql
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_classes_school_status ON classes(school_id, status);
```

**约束**：
```sql
ALTER TABLE classes ADD CONSTRAINT chk_classes_stage
  CHECK (stage IS NULL OR stage IN ('foundation', 'intensive', 'sprint'));
ALTER TABLE classes ADD CONSTRAINT chk_classes_status
  CHECK (status IN ('active', 'archived'));
```

---

### 7.7 class_teachers — 老师-班级关系（N:M）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| class_id | uuid | NOT NULL | — | 班级（逻辑关联 classes.id） |
| teacher_id | uuid | NOT NULL | — | 老师（逻辑关联 users.id） |
| teacher_role_id | uuid | — | — | 班级内角色（逻辑关联 teacher_roles.id，覆盖全局默认） |
| joined_at | timestamptz | NOT NULL | now() | 加入时间 |

> 班级内角色通过 `teacher_role_id` 引用 `teacher_roles` 表，不硬编码枚举。为空时回退到 `teacher_profiles.teacher_role_id`。

---

### 7.8 class_students — 学生-班级关系（N:M）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| class_id | uuid | NOT NULL | — | 班级（逻辑关联 classes.id） |
| student_id | uuid | NOT NULL | — | 学生（逻辑关联 users.id） |
| group_name | varchar(50) | — | — | 班内分组（冲刺组 / A组 / B组） |
| status | varchar(20) | NOT NULL | 'active' | active / transferred / graduated |
| joined_at | timestamptz | NOT NULL | now() | 加入时间 |

**索引**：
```sql
CREATE UNIQUE INDEX idx_class_students_unique ON class_students(class_id, student_id);
CREATE INDEX idx_class_students_student ON class_students(student_id);
CREATE INDEX idx_class_students_class_status ON class_students(class_id, status);
```

**约束**：
```sql
ALTER TABLE class_students ADD CONSTRAINT chk_class_students_status
  CHECK (status IN ('active', 'transferred', 'graduated'));
```

---

### 7.9 parent_student_relations — 家长-学生绑定（N:M）

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | uuid | PK | gen_random_uuid() | 主键 |
| parent_id | uuid | NOT NULL | — | 家长（逻辑关联 users.id） |
| student_id | uuid | NOT NULL | — | 学生（逻辑关联 users.id） |
| relation_type | varchar(20) | NOT NULL | — | father / mother / guardian |
| binding_status | varchar(20) | NOT NULL | 'pending' | pending / active / revoked |
| created_at | timestamptz | NOT NULL | now() | 创建时间 |
| updated_at | timestamptz | NOT NULL | now() | 更新时间 |

**索引**：
```sql
CREATE UNIQUE INDEX idx_parent_student_unique ON parent_student_relations(parent_id, student_id);
CREATE INDEX idx_parent_student_student ON parent_student_relations(student_id);
CREATE INDEX idx_parent_student_status ON parent_student_relations(binding_status);
```

**约束**：
```sql
ALTER TABLE parent_student_relations ADD CONSTRAINT chk_parent_student_relation
  CHECK (relation_type IN ('father', 'mother', 'guardian'));
ALTER TABLE parent_student_relations ADD CONSTRAINT chk_parent_student_binding
  CHECK (binding_status IN ('pending', 'active', 'revoked'));
ALTER TABLE parent_student_relations ADD CONSTRAINT chk_parent_not_student
  CHECK (parent_id != student_id);
```

---

### 7.10 表关系总览

```
schools
  │
  ├── 1:N → users (school_id)
  └── 1:N → classes (school_id)

users
  ├── 1:1 → teacher_profiles (user_id)
  ├── 1:1 → student_profiles (user_id)
  ├── 1:1 → parent_profiles (user_id)
  ├── N:M → classes  via class_teachers (teacher_id)
  ├── N:M → classes  via class_students (student_id)
  └── N:M → users    via parent_student_relations (parent_id ↔ student_id)

teacher_roles
  ├── N:1 → schools (school_id)
  └── N:M → permissions  via teacher_role_permissions
```

### 7.11 权限层（3 张表）

> 详细字段定义见 `docs/database-schema.md`

| 表 | 字段数 | 职责 |
|---|:------:|------|
| teacher_roles | 9 | 老师职能角色定义，每个学校独立维护 |
| permissions | 8 | 权限定义，系统预置 14 条 |
| teacher_role_permissions | 4 | 角色-权限映射，后台可配置 |

### 7.12 统计

| 指标 | 数量 |
|------|------|
| 表 | 12 |
| 字段总数 | 84 |
| 索引 | 25（含 PK 和 UNIQUE） |
| 外键 | 0（应用层保证引用完整性） |
| CHECK 约束 | 14 |
| jsonb 字段 | 1（schools.settings） |
| text[] 字段 | 2（users.roles, teacher_profiles.subjects） |

### 7.13 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 数据库 | PostgreSQL | 项目已有，原生支持 text[]、jsonb、GIN 索引 |
| ORM | Drizzle | 项目已有，text[] 一等公民支持 |
| 短信服务 | 阿里云 SMS | 国内到达率高，有验证码模板 |
| Session 存储 | Redis | TTL 管理、高性能读写 |
| 密码哈希 | bcrypt（预留） | 未来支持密码登录 |

### 7.14 Drizzle text[] 注意事项

| 问题 | 解法 |
|------|------|
| 默认空数组 | 用 `default(sql\`'{}'::text[]\`)` 不用 `default([])` |
| 数组元素可能为 NULL | 应用层 Zod 校验枚举值 |
| 无 FK 约束 | 应用层校验引用完整性 |
| 相等比较有序 | 查询用 `arrayContains` / `arrayOverlaps`，不用 `eq` |

### 7.15 后续业务扩展预留

以下字段/表在业务迭代时按需添加，不在基础用户体系中预设：

| 扩展项 | 归属表 | 触发时机 |
|--------|--------|---------|
| 分层字段（tier, tier_labels, risk_labels） | student_profiles | 分层与诊断业务设计时 |
| 通知偏好（notification_prefs） | parent_profiles | 消息推送业务设计时 |
| 邀请码表（invitations） | 新建表 | 用户获取方式确定后 |

---

## 八、实现路径

| 阶段 | 内容 | 产出 |
|------|------|------|
| **Phase 1: 认证闭环** | 验证码发送 → 登录 → Token → 拦截器 → 登出 → 角色切换 | 用户可登录，有 session |
| **Phase 2: 角色与组织** | 学校/班级 CRUD、老师管理、学生导入 | 组织结构可管理 |
| **Phase 3: 关系管理** | 家长绑定学生、老师分配班级、学生加入班级 | 用户关系可建立 |
| **Phase 4: 权限校验** | 中间件权限拦截、资源归属校验、数据可见性过滤 | 数据隔离生效 |
| **Phase 5: API 层** | 完整 RESTful API 设计与实现 | 前端可对接 |
| **Phase 6: UI 层** | 各角色管理界面 | 用户可操作 |
