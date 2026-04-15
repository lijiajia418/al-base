# 用户体系 API 设计

**版本**: v1.2
**日期**: 2026-04-09
**关联**: user-system-design.md v2.1

---

## 一、API 总览

### 1.1 设计原则

| 原则 | 说明 |
|------|------|
| RESTful | 资源导向，标准 HTTP 动词 |
| 统一前缀 | 所有接口 `/api/v1/` |
| 统一响应 | `{ code, data, message }` |
| 认证方式 | `Authorization: Bearer {token}`，白名单路由除外 |
| 角色视角 | `X-Active-Role` header 指定当前角色 |
| 分页 | `?page=1&pageSize=20`，返回 `{ items, total, page, pageSize }` |

### 1.2 统一响应格式

```json
// 成功
{
  "code": 0,
  "data": { ... },
  "message": "success"
}

// 失败
{
  "code": 40101,
  "data": null,
  "message": "TOKEN_EXPIRED"
}
```

### 1.3 错误码规范

| 范围 | 类别 | 示例 |
|------|------|------|
| 400xx | 参数错误 | 40001 手机号格式错误 |
| 401xx | 认证错误 | 40101 Token 过期，40102 验证码错误 |
| 403xx | 权限错误 | 40301 角色无权限，40302 资源不可访问 |
| 404xx | 资源不存在 | 40401 用户不存在 |
| 409xx | 冲突 | 40901 手机号已注册 |
| 500xx | 服务端错误 | 50001 短信发送失败 |

### 1.4 API 分组概览

| 分组 | 路由前缀 | 数量 | 鉴权 |
|------|---------|:----:|------|
| 认证 | `/api/v1/auth` | 5 | 部分白名单 |
| 用户 | `/api/v1/users` | 1 | 需登录 |
| 学校 | `/api/v1/schools` | 3 | school_admin |
| 老师管理 | `/api/v1/teachers` | 5 | school_admin |
| 班级 | `/api/v1/classes` | 7 | school_admin / teacher |
| 学生 | `/api/v1/students` | 4 | school_admin / teacher / student |
| 家长 | `/api/v1/parents` | 4 | school_admin / teacher / parent |
| 角色权限 | `/api/v1/teacher-roles` `/api/v1/permissions` | 6 | school_admin |
| **合计** | | **35** | |

---

## 二、认证模块（Auth）

> 登录注册、会话管理、角色切换

| # | 方法 | 路径 | 鉴权 | 说明 |
|---|------|------|------|------|
| A1 | POST | `/api/v1/auth/sms-code` | 无 | 发送验证码 |
| A2 | POST | `/api/v1/auth/login` | 无 | 验证码登录 |
| A3 | POST | `/api/v1/auth/logout` | Token | 登出 |
| A4 | GET | `/api/v1/auth/me` | Token | 获取当前用户信息 |
| A5 | POST | `/api/v1/auth/switch-role` | Token | 切换当前激活角色 |

### A1 发送验证码

```
POST /api/v1/auth/sms-code

Request:
{
  "phone": "13800001234"
}

Response:
{
  "code": 0,
  "data": {
    "cooldown": 60          // 下次可发送的等待秒数
  },
  "message": "success"
}

错误场景:
  40001 — 手机号格式错误
  42901 — 发送过于频繁（60秒内）
  42902 — 今日发送次数已达上限
  42903 — 手机号已被锁定（验证失败过多）
```

### A2 验证码登录

```
POST /api/v1/auth/login

Request:
{
  "phone": "13800001234",
  "code": "123456"
}

Response:
{
  "code": 0,
  "data": {
    "token": "a3f8c2e1-4b5d-...",
    "user": {
      "id": "uuid",
      "phone": "138****1234",
      "name": "张老师",
      "roles": ["teacher"],
      "schoolId": "uuid",
      "status": "active"
    },
    "isNewUser": false      // 是否新注册用户
  },
  "message": "success"
}

逻辑:
  手机号不存在 → 自动创建用户（roles=[], isNewUser=true）
  手机号存在 → 取出用户，更新 last_login_at
  pending_activation → 首次登录改为 active

错误场景:
  40102 — 验证码错误
  40103 — 验证码已过期
  42903 — 手机号已被锁定
  40301 — 账号已停用
```

### A3 登出

```
POST /api/v1/auth/logout

Headers: Authorization: Bearer {token}

Response:
{
  "code": 0,
  "data": null,
  "message": "success"
}
```

### A4 获取当前用户信息

```
GET /api/v1/auth/me

Headers: Authorization: Bearer {token}

Response:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "phone": "138****1234",
    "name": "张老师",
    "email": null,
    "avatarUrl": null,
    "roles": ["teacher", "parent"],
    "activeRole": "teacher",
    "schoolId": "uuid",
    "schoolName": "XX国际学校",
    "status": "active",
    "lastLoginAt": "2026-04-09T10:00:00Z",
    "profile": {                    // 当前角色对应的 profile
      "title": "IELTS老师",
      "subjects": ["IELTS"],
      "employmentStatus": "active"
    }
  },
  "message": "success"
}
```

### A5 切换角色

```
POST /api/v1/auth/switch-role

Headers: Authorization: Bearer {token}

Request:
{
  "role": "parent"
}

Response:
{
  "code": 0,
  "data": {
    "activeRole": "parent",
    "profile": {                    // 切换后角色的 profile
      "relationType": "mother"
    }
  },
  "message": "success"
}

错误场景:
  40301 — 用户不拥有该角色
```

---

## 三、用户模块（Users）

> 用户个人信息管理

| # | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|
| U1 | PUT | `/api/v1/users/profile` | 所有 | 更新个人信息 |

> **已合并/移除**：原 U1(GET profile) 与 A4(/auth/me) 重复，合并到 A4。原 U3(头像) 和 U4(换绑手机号) 移到 v1.1。

### U1 更新个人信息

```
PUT /api/v1/users/profile

Request:
{
  "name": "张小明",                // 可选
  "email": "zhang@example.com"     // 可选
}

Response:
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "张小明",
    "email": "zhang@example.com"
  },
  "message": "success"
}
```

---

## 四、学校模块（Schools）

> 学校管理员管理学校信息

| # | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|
| S1 | GET | `/api/v1/schools/current` | school_admin | 获取当前学校信息 |
| S2 | PUT | `/api/v1/schools/current` | school_admin | 更新学校信息 |
| S3 | GET | `/api/v1/schools/stats` | school_admin | 获取学校统计概览 |

### S1 获取当前学校信息

```
GET /api/v1/schools/current

Response.data:
{
  "id": "uuid",
  "name": "XX国际学校",
  "code": "XXGJ-2026",
  "settings": { ... },
  "status": "active",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### S2 更新学校信息

```
PUT /api/v1/schools/current

Request:
{
  "name": "XX国际学校",           // 可选
  "settings": {                   // 可选，合并更新
    "gradingScale": "ielts_9"
  }
}
```

### S3 获取学校统计概览

```
GET /api/v1/schools/stats

Response.data:
{
  "teacherCount": 12,
  "studentCount": 86,
  "classCount": 5,
  "parentCount": 64,
  "activeClassCount": 4
}
```

---

## 五、老师管理模块（Teachers）

> 学校管理员管理老师

| # | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|
| T1 | GET | `/api/v1/teachers` | school_admin | 老师列表 |
| T2 | POST | `/api/v1/teachers` | school_admin | 添加老师 |
| T3 | GET | `/api/v1/teachers/:id` | school_admin | 老师详情 |
| T4 | PUT | `/api/v1/teachers/:id` | school_admin | 编辑老师信息 |
| T5 | PUT | `/api/v1/teachers/:id/status` | school_admin | 停用/启用老师 |

### T1 老师列表

```
GET /api/v1/teachers?page=1&pageSize=20&status=active&keyword=张

Response.data:
{
  "items": [
    {
      "id": "uuid",                  // user.id
      "name": "张老师",
      "phone": "138****1234",
      "title": "IELTS老师",
      "subjects": ["IELTS"],
      "employmentStatus": "active",
      "classCount": 2,               // 负责班级数
      "status": "active",            // user.status
      "createdAt": "2026-03-15T00:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 20
}
```

### T2 添加老师

```
POST /api/v1/teachers

Request:
{
  "phone": "13800001234",
  "name": "张老师",
  "title": "IELTS老师",              // 可选
  "subjects": ["IELTS"]              // 可选
}

逻辑:
  手机号已存在 → 追加 teacher 角色 + 创建 teacher_profile
  手机号不存在 → 创建 user + teacher_profile

Response.data:
{
  "id": "uuid",
  "phone": "138****1234",
  "name": "张老师",
  "status": "pending_activation"
}

错误场景:
  40901 — 该用户已是老师
  40001 — 手机号格式错误
```

### T3 老师详情

```
GET /api/v1/teachers/:id

Response.data:
{
  "id": "uuid",
  "name": "张老师",
  "phone": "138****1234",
  "title": "IELTS老师",
  "subjects": ["IELTS"],
  "employmentStatus": "active",
  "status": "active",
  "lastLoginAt": "2026-04-09T10:00:00Z",
  "createdAt": "2026-03-15T00:00:00Z",
  "classes": [                       // 负责的班级
    {
      "id": "uuid",
      "name": "Year 12 IELTS A班",
      "teacherRole": { "id": "uuid", "name": "主讲老师" },
      "studentCount": 32
    }
  ]
}
```

### T4 编辑老师信息

```
PUT /api/v1/teachers/:id

Request:
{
  "name": "张老师",                  // 可选
  "title": "IELTS高级老师",          // 可选
  "subjects": ["IELTS", "EAL"]      // 可选
}
```

### T5 停用/启用老师

```
PUT /api/v1/teachers/:id/status

Request:
{
  "action": "suspend"               // suspend / activate / resign
}

逻辑:
  suspend → user.status = 'suspended'，清除该用户所有 session
  activate → user.status = 'active'
  resign → teacher_profiles.employment_status = 'resigned'
```

---

## 六、班级模块（Classes）

> 班级管理、班级成员管理

| # | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|
| C1 | GET | `/api/v1/classes` | school_admin, teacher | 班级列表 |
| C2 | POST | `/api/v1/classes` | school_admin, teacher | 创建班级 |
| C3 | GET | `/api/v1/classes/:id` | school_admin, teacher | 班级详情 |
| C4 | PUT | `/api/v1/classes/:id` | school_admin, teacher | 编辑班级 |
| C5 | PUT | `/api/v1/classes/:id/status` | school_admin | 归档/激活班级 |
| C6 | POST | `/api/v1/classes/:id/teachers` | school_admin | 分配老师到班级 |
| C7 | DELETE | `/api/v1/classes/:id/teachers/:teacherId` | school_admin | 移除班级老师 |

### C1 班级列表

```
GET /api/v1/classes?page=1&pageSize=20&grade=Year 12&status=active

角色差异:
  school_admin → 返回全校班级
  teacher → 只返回自己负责的班级

Response.data:
{
  "items": [
    {
      "id": "uuid",
      "name": "Year 12 IELTS A班",
      "grade": "Year 12",
      "academicYear": "2025-2026",
      "stage": "foundation",
      "status": "active",
      "studentCount": 32,
      "teachers": [
        { "id": "uuid", "name": "张老师", "teacherRole": { "id": "uuid", "name": "主讲老师" } }
      ]
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

### C2 创建班级

```
POST /api/v1/classes

Request:
{
  "name": "Year 12 IELTS A班",
  "grade": "Year 12",
  "academicYear": "2025-2026",
  "stage": "foundation",            // 可选
  "primaryTeacherId": "uuid"        // 可选，主讲老师
}

逻辑:
  创建 classes 记录
  如果指定 primaryTeacherId → 同时创建 class_teachers 记录
  老师创建班级时 → 自动将自己设为 primary，无需传 primaryTeacherId
```

### C3 班级详情

```
GET /api/v1/classes/:id

Response.data:
{
  "id": "uuid",
  "name": "Year 12 IELTS A班",
  "grade": "Year 12",
  "academicYear": "2025-2026",
  "stage": "foundation",
  "status": "active",
  "createdAt": "2026-03-01T00:00:00Z",
  "teachers": [
    { "id": "uuid", "name": "张老师", "teacherRole": { "id": "uuid", "name": "主讲老师" }, "joinedAt": "..." }
  ],
  "studentCount": 32,
  "groupSummary": {                  // 分组统计
    "A组": 15,
    "B组": 12,
    "冲刺组": 5
  }
}
```

### C4 编辑班级

```
PUT /api/v1/classes/:id

Request:
{
  "name": "Year 12 IELTS A班",     // 可选
  "stage": "intensive",             // 可选
  "grade": "Year 12"                // 可选
}
```

### C5 归档/激活班级

```
PUT /api/v1/classes/:id/status

Request:
{
  "action": "archive"              // archive / activate
}
```

### C6 分配老师到班级

```
POST /api/v1/classes/:id/teachers

Request:
{
  "teacherId": "uuid",
  "teacherRoleId": "uuid"           // 逻辑关联 teacher_roles.id，该老师在此班级的职能角色
}

错误场景:
  40901 — 该老师已在此班级
  40401 — 老师不存在
  40402 — 角色不存在
```

### C7 移除班级老师

```
DELETE /api/v1/classes/:id/teachers/:teacherId

错误场景:
  40401 — 该老师不在此班级
```

---

## 七、学生模块（Students）

> 老师管理班级学生

| # | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|
| ST1 | GET | `/api/v1/classes/:classId/students` | school_admin, teacher | 班级学生列表 |
| ST2 | POST | `/api/v1/classes/:classId/students` | school_admin, teacher | 添加学生到班级 |
| ST3 | GET | `/api/v1/students/:id` | school_admin, teacher, student | 学生详情 |
| ST4 | PUT | `/api/v1/classes/:classId/students/:studentId` | school_admin, teacher | 更新学生班级信息 |

> **已移除**：批量导入学生（原 ST3）移到 v1.1。

### ST1 班级学生列表

```
GET /api/v1/classes/:classId/students?page=1&pageSize=50&groupName=A组&status=active

Response.data:
{
  "items": [
    {
      "id": "uuid",                  // user.id
      "name": "王小明",
      "phone": "136****3456",
      "grade": "Year 12",
      "targetScore": "6.5",
      "examDate": "2026-11-01",
      "groupName": "A组",
      "status": "active",            // class_students.status
      "joinedAt": "2026-03-01T00:00:00Z",
      "parentCount": 1               // 已绑定家长数
    }
  ],
  "total": 32,
  "page": 1,
  "pageSize": 50
}
```

### ST2 添加学生到班级

```
POST /api/v1/classes/:classId/students

Request:
{
  "phone": "13600003456",
  "name": "王小明",
  "grade": "Year 12",              // 可选
  "targetScore": 6.5,              // 可选
  "examDate": "2026-11-01",        // 可选
  "groupName": "A组"               // 可选
}

逻辑:
  手机号已存在 → 追加 student 角色 + 关联 class_students
  手机号不存在 → 创建 user + student_profile + class_students

错误场景:
  40901 — 该学生已在此班级
  40001 — 手机号格式错误
```

### ST3 学生详情

```
GET /api/v1/students/:id

角色差异:
  teacher → 需校验学生在自己班级中
  school_admin → 全校学生均可查看
  student → 只能查看自己（id = 当前用户）

Response.data:
{
  "id": "uuid",
  "name": "王小明",
  "phone": "136****3456",
  "grade": "Year 12",
  "targetScore": "6.5",
  "examDate": "2026-11-01",
  "status": "active",
  "classes": [                       // 所在班级
    {
      "id": "uuid",
      "name": "Year 12 IELTS A班",
      "groupName": "A组",
      "status": "active"
    }
  ],
  "parents": [                       // 绑定的家长
    {
      "id": "uuid",
      "name": "王爸爸",
      "phone": "138****5678",
      "relationType": "father",
      "bindingStatus": "active"
    }
  ]
}
```

### ST4 更新学生班级信息

```
PUT /api/v1/classes/:classId/students/:studentId

Request:
{
  "groupName": "冲刺组",            // 可选，调整分组
  "status": "transferred"           // 可选，转出
}
```

---

## 八、家长模块（Parents）

> 家长绑定管理 + 家长只读数据

| # | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|
| P1 | POST | `/api/v1/students/:studentId/parents` | teacher, school_admin | 为学生添加家长 |
| P2 | GET | `/api/v1/students/:studentId/parents` | teacher, school_admin | 查看学生的家长列表 |
| P3 | PUT | `/api/v1/parents/relations/:id` | teacher, school_admin | 更新家长绑定状态 |
| P4 | GET | `/api/v1/parents/children` | parent | 家长查看自己绑定的孩子列表 |

### P1 为学生添加家长

```
POST /api/v1/students/:studentId/parents

Request:
{
  "phone": "13800005678",
  "name": "王爸爸",                 // 可选
  "relationType": "father"          // father / mother / guardian
}

逻辑:
  手机号已存在 → 追加 parent 角色 + 创建 parent_student_relations
  手机号不存在 → 创建 user + parent_profile + parent_student_relations
  binding_status 默认 active（老师添加视为已确认）

错误场景:
  40901 — 该家长已绑定此学生
  40001 — 手机号格式错误
  40001 — 家长手机号与学生手机号相同
```

### P2 查看学生的家长列表

```
GET /api/v1/students/:studentId/parents

Response.data:
[
  {
    "relationId": "uuid",           // parent_student_relations.id
    "parentId": "uuid",
    "name": "王爸爸",
    "phone": "138****5678",
    "relationType": "father",
    "bindingStatus": "active"
  }
]
```

### P3 更新家长绑定状态

```
PUT /api/v1/parents/relations/:id

Request:
{
  "bindingStatus": "revoked"        // active / revoked
}
```

### P4 家长查看自己绑定的孩子列表

```
GET /api/v1/parents/children

Response.data:
[
  {
    "studentId": "uuid",
    "name": "王小明",
    "grade": "Year 12",
    "targetScore": "6.5",
    "examDate": "2026-11-01",
    "relationType": "father",
    "classes": [
      { "id": "uuid", "name": "Year 12 IELTS A班" }
    ]
  }
]
```

---

## 九、角色权限管理模块（Teacher Roles & Permissions）

> 管理员维护老师职能角色和权限配置

| # | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|
| R1 | GET | `/api/v1/teacher-roles` | school_admin | 角色列表 |
| R2 | POST | `/api/v1/teacher-roles` | school_admin | 创建角色 |
| R3 | GET | `/api/v1/teacher-roles/:id` | school_admin | 角色详情（含权限列表） |
| R4 | PUT | `/api/v1/teacher-roles/:id` | school_admin | 编辑角色 |
| R5 | PUT | `/api/v1/teacher-roles/:id/permissions` | school_admin | 配置角色权限 |
| R6 | GET | `/api/v1/permissions` | school_admin | 获取所有可分配的权限列表 |

### R1 角色列表

```
GET /api/v1/teacher-roles

Response.data:
[
  {
    "id": "uuid",
    "name": "主讲老师",
    "code": "instructor",
    "description": "负责班级教学和任务布置",
    "isSystem": true,
    "status": "active",
    "teacherCount": 8,                // 使用该角色的老师数
    "permissionCount": 10             // 拥有的权限数
  }
]
```

### R2 创建角色

```
POST /api/v1/teacher-roles

Request:
{
  "name": "年级组长",
  "code": "grade_leader",
  "description": "负责年级教学管理",
  "permissionIds": ["uuid", "uuid", ...]    // 可选，创建时直接分配权限
}

错误场景:
  40901 — 该学校已存在同名/同 code 角色
```

### R3 角色详情

```
GET /api/v1/teacher-roles/:id

Response.data:
{
  "id": "uuid",
  "name": "主讲老师",
  "code": "instructor",
  "description": "负责班级教学和任务布置",
  "isSystem": true,
  "status": "active",
  "permissions": [
    { "id": "uuid", "code": "class:create", "name": "创建班级", "scope": "global", "category": "class" },
    { "id": "uuid", "code": "task:assign", "name": "布置任务", "scope": "class", "category": "task" }
  ]
}
```

### R4 编辑角色

```
PUT /api/v1/teacher-roles/:id

Request:
{
  "name": "主讲老师",              // 可选
  "description": "...",            // 可选
  "status": "active"               // 可选，active / disabled
}

错误场景:
  40301 — 系统预置角色不可删除（is_system=true），但可编辑名称和描述
```

### R5 配置角色权限

```
PUT /api/v1/teacher-roles/:id/permissions

Request:
{
  "permissionIds": ["uuid", "uuid", ...]    // 全量替换该角色的权限列表
}

逻辑:
  删除该角色的所有旧权限映射 → 批量插入新映射
```

### R6 获取所有可分配的权限

```
GET /api/v1/permissions

Response.data:
[
  {
    "id": "uuid",
    "code": "class:create",
    "name": "创建班级",
    "scope": "global",
    "category": "class",
    "description": "允许创建新的班级"
  }
]

分组返回，按 category 归类，方便后台 UI 分组展示勾选。
```

---

## 十、API 完整清单

| # | 模块 | 方法 | 路径 | 角色 | 说明 |
|---|------|------|------|------|------|
| A1 | 认证 | POST | `/api/v1/auth/sms-code` | 公开 | 发送验证码 |
| A2 | 认证 | POST | `/api/v1/auth/login` | 公开 | 登录 |
| A3 | 认证 | POST | `/api/v1/auth/logout` | 全部 | 登出 |
| A4 | 认证 | GET | `/api/v1/auth/me` | 全部 | 当前用户信息（含 profile） |
| A5 | 认证 | POST | `/api/v1/auth/switch-role` | 全部 | 切换角色 |
| U1 | 用户 | PUT | `/api/v1/users/profile` | 全部 | 更新个人信息（name/email） |
| S1 | 学校 | GET | `/api/v1/schools/current` | admin | 学校信息 |
| S2 | 学校 | PUT | `/api/v1/schools/current` | admin | 更新学校 |
| S3 | 学校 | GET | `/api/v1/schools/stats` | admin | 学校统计 |
| T1 | 老师 | GET | `/api/v1/teachers` | admin | 老师列表 |
| T2 | 老师 | POST | `/api/v1/teachers` | admin | 添加老师 |
| T3 | 老师 | GET | `/api/v1/teachers/:id` | admin | 老师详情 |
| T4 | 老师 | PUT | `/api/v1/teachers/:id` | admin | 编辑老师 |
| T5 | 老师 | PUT | `/api/v1/teachers/:id/status` | admin | 停用/启用 |
| C1 | 班级 | GET | `/api/v1/classes` | admin, teacher | 班级列表 |
| C2 | 班级 | POST | `/api/v1/classes` | admin, teacher | 创建班级 |
| C3 | 班级 | GET | `/api/v1/classes/:id` | admin, teacher | 班级详情 |
| C4 | 班级 | PUT | `/api/v1/classes/:id` | admin, teacher | 编辑班级 |
| C5 | 班级 | PUT | `/api/v1/classes/:id/status` | admin | 归档/激活 |
| C6 | 班级 | POST | `/api/v1/classes/:id/teachers` | admin | 分配老师 |
| C7 | 班级 | DELETE | `/api/v1/classes/:id/teachers/:tid` | admin | 移除老师 |
| ST1 | 学生 | GET | `/api/v1/classes/:cid/students` | admin, teacher | 班级学生列表 |
| ST2 | 学生 | POST | `/api/v1/classes/:cid/students` | admin, teacher | 添加学生 |
| ST3 | 学生 | GET | `/api/v1/students/:id` | admin, teacher, student | 学生详情 |
| ST4 | 学生 | PUT | `/api/v1/classes/:cid/students/:sid` | admin, teacher | 更新学生班级信息 |
| P1 | 家长 | POST | `/api/v1/students/:sid/parents` | admin, teacher | 添加家长 |
| P2 | 家长 | GET | `/api/v1/students/:sid/parents` | admin, teacher | 学生家长列表 |
| P3 | 家长 | PUT | `/api/v1/parents/relations/:id` | admin, teacher | 更新绑定状态 |
| P4 | 家长 | GET | `/api/v1/parents/children` | parent | 我的孩子列表 |
| R1 | 角色权限 | GET | `/api/v1/teacher-roles` | admin | 角色列表 |
| R2 | 角色权限 | POST | `/api/v1/teacher-roles` | admin | 创建角色 |
| R3 | 角色权限 | GET | `/api/v1/teacher-roles/:id` | admin | 角色详情（含权限） |
| R4 | 角色权限 | PUT | `/api/v1/teacher-roles/:id` | admin | 编辑角色 |
| R5 | 角色权限 | PUT | `/api/v1/teacher-roles/:id/permissions` | admin | 配置角色权限 |
| R6 | 角色权限 | GET | `/api/v1/permissions` | admin | 权限列表 |

> **v1.1 规划**：头像上传（PUT /users/avatar）、换绑手机号（PUT /users/phone）、批量导入学生（POST /classes/:cid/students/batch）

---

## 十一、中间件与横切关注点

### 10.1 白名单路由

以下路由不需要 Token：

```
POST /api/v1/auth/sms-code
POST /api/v1/auth/login
GET  /api/v1/health
```

### 11.2 角色-路由映射（第一层：身份角色）

```typescript
const ROUTE_ROLES = {
  // 仅管理员
  'PUT  /api/v1/classes/:id/status':         ['school_admin'],
  'POST /api/v1/classes/:id/teachers':       ['school_admin'],
  'DELETE /api/v1/classes/:id/teachers/:id': ['school_admin'],

  // 老师管理（仅管理员）
  'GET  /api/v1/teachers':                   ['school_admin'],
  'POST /api/v1/teachers':                   ['school_admin'],
  'PUT  /api/v1/teachers/:id':               ['school_admin'],
  'PUT  /api/v1/teachers/:id/status':        ['school_admin'],

  // 角色权限管理（仅管理员）
  'GET  /api/v1/teacher-roles':              ['school_admin'],
  'POST /api/v1/teacher-roles':              ['school_admin'],
  'GET  /api/v1/teacher-roles/:id':          ['school_admin'],
  'PUT  /api/v1/teacher-roles/:id':          ['school_admin'],
  'PUT  /api/v1/teacher-roles/:id/permissions': ['school_admin'],
  'GET  /api/v1/permissions':                ['school_admin'],

  // 班级 + 学生（管理员 + 老师）
  // 注意：teacher 通过第一层后，还要走第二层职能权限判定
  'GET  /api/v1/classes':                    ['school_admin', 'teacher'],
  'POST /api/v1/classes':                    ['school_admin', 'teacher'],
  'GET  /api/v1/classes/:id':               ['school_admin', 'teacher'],
  'PUT  /api/v1/classes/:id':               ['school_admin', 'teacher'],
  'GET  /api/v1/classes/:id/students':      ['school_admin', 'teacher'],
  'POST /api/v1/classes/:id/students':      ['school_admin', 'teacher'],
  'PUT  /api/v1/classes/:id/students/:id':  ['school_admin', 'teacher'],

  // 学生详情
  'GET  /api/v1/students/:id':              ['school_admin', 'teacher', 'student'],

  // 家长管理
  'POST /api/v1/students/:id/parents':      ['school_admin', 'teacher'],
  'GET  /api/v1/students/:id/parents':      ['school_admin', 'teacher'],
  'PUT  /api/v1/parents/relations/:id':     ['school_admin', 'teacher'],

  // 家长自用
  'GET  /api/v1/parents/children':          ['parent'],
}
```

### 11.3 teacher 职能权限映射（第二层：查数据库）

当第一层判定 activeRole = teacher 后，进入第二层：

```typescript
// 路由 → 需要的权限编码（permissions.code）
const ROUTE_TEACHER_PERMISSIONS = {
  'POST /api/v1/classes':                    'class:create',     // scope=global
  'PUT  /api/v1/classes/:id':               'class:edit',        // scope=class
  'POST /api/v1/classes/:id/students':      'student:add',       // scope=class
  'GET  /api/v1/classes/:id/students':      'student:view',      // scope=class
  'PUT  /api/v1/classes/:id/students/:id':  'student:edit',      // scope=class
  'POST /api/v1/students/:id/parents':      'parent:add',        // scope=class
  'GET  /api/v1/students/:id/parents':      'parent:view',       // scope=class
}

// 判定逻辑：
// scope=global → 查 teacher_profiles.teacher_role_id 的权限
// scope=class  → 查 class_teachers.teacher_role_id 的权限（空则回退全局）
```

### 11.4 资源归属校验（第三层）

职能权限通过后，还需检查资源归属：

| 角色 | 校验逻辑 |
|------|---------|
| teacher 访问班级 | 该老师在 class_teachers 中有记录 |
| teacher 访问学生 | 该学生在老师的某个班级中 |
| student 访问自己 | studentId = 当前 userId |
| parent 访问孩子 | parent_student_relations 中 binding_status = 'active' |
