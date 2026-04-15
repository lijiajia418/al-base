# 数据库 Schema — 用户体系

**版本**: v2.0
**日期**: 2026-04-09
**数据库**: PostgreSQL 16
**表数量**: 12

---

## 完整 DDL

```sql
-- ============================================================
-- 用户体系数据库 Schema
-- 数据库: albase
-- 共 12 张表，无 FK 约束，应用层保证引用完整性
-- v2.0: 新增权限体系（teacher_roles + permissions + teacher_role_permissions）
-- ============================================================

-- ------------------------------------------------------------
-- 1. schools — 学校（租户隔离边界）
-- ------------------------------------------------------------
CREATE TABLE schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(100) NOT NULL,
  code        varchar(20)  NOT NULL,
  settings    jsonb        NOT NULL DEFAULT '{}',
  status      varchar(20)  NOT NULL DEFAULT 'active',
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_schools_code ON schools(code);

ALTER TABLE schools ADD CONSTRAINT chk_schools_status
  CHECK (status IN ('active', 'suspended'));

-- ------------------------------------------------------------
-- 2. users — 统一用户表
-- ------------------------------------------------------------
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid         NOT NULL,                          -- 逻辑关联 schools.id
  phone          varchar(20)  NOT NULL,
  email          varchar(255),
  name           varchar(50)  NOT NULL,
  avatar_url     text,
  roles          text[]       NOT NULL DEFAULT '{}'::text[],      -- school_admin/teacher/student/parent
  status         varchar(20)  NOT NULL DEFAULT 'active',
  password_hash  varchar(255),                                    -- 预留，MVP 不用
  last_login_at  timestamptz,
  created_by     uuid,                                            -- 逻辑关联 users.id
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_roles ON users USING GIN(roles);
CREATE INDEX idx_users_status ON users(status);

ALTER TABLE users ADD CONSTRAINT chk_users_phone_format
  CHECK (phone ~ '^\d{11}$');
ALTER TABLE users ADD CONSTRAINT chk_users_status
  CHECK (status IN ('active', 'pending_activation', 'inactive', 'suspended'));

-- ------------------------------------------------------------
-- 3. teacher_profiles — 老师扩展（1:1 → users）
-- ------------------------------------------------------------
CREATE TABLE teacher_profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid         NOT NULL,                       -- 逻辑关联 users.id
  teacher_role_id    uuid,                                        -- 逻辑关联 teacher_roles.id，全局默认职能角色
  title              varchar(50),
  subjects           text[]       NOT NULL DEFAULT '{}'::text[],
  employment_status  varchar(20)  NOT NULL DEFAULT 'active',
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_teacher_profiles_user ON teacher_profiles(user_id);

ALTER TABLE teacher_profiles ADD CONSTRAINT chk_teacher_employment
  CHECK (employment_status IN ('active', 'resigned'));

-- ------------------------------------------------------------
-- 4. student_profiles — 学生扩展（1:1 → users）
-- ------------------------------------------------------------
CREATE TABLE student_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid           NOT NULL,                          -- 逻辑关联 users.id
  grade         varchar(20),
  target_score  decimal(3,1),
  exam_date     date,
  created_at    timestamptz    NOT NULL DEFAULT now(),
  updated_at    timestamptz    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_student_profiles_user ON student_profiles(user_id);

ALTER TABLE student_profiles ADD CONSTRAINT chk_student_target_score
  CHECK (target_score IS NULL OR (target_score >= 0 AND target_score <= 9));

-- ------------------------------------------------------------
-- 5. parent_profiles — 家长扩展（1:1 → users）
-- ------------------------------------------------------------
CREATE TABLE parent_profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL,                           -- 逻辑关联 users.id
  relation_type  varchar(20),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_parent_profiles_user ON parent_profiles(user_id);

-- ------------------------------------------------------------
-- 6. classes — 班级
-- ------------------------------------------------------------
CREATE TABLE classes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid         NOT NULL,                           -- 逻辑关联 schools.id
  name           varchar(100) NOT NULL,
  grade          varchar(20),
  academic_year  varchar(20),
  stage          varchar(20),
  status         varchar(20)  NOT NULL DEFAULT 'active',
  created_by     uuid         NOT NULL,                           -- 逻辑关联 users.id
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_classes_school_status ON classes(school_id, status);

ALTER TABLE classes ADD CONSTRAINT chk_classes_stage
  CHECK (stage IS NULL OR stage IN ('foundation', 'intensive', 'sprint'));
ALTER TABLE classes ADD CONSTRAINT chk_classes_status
  CHECK (status IN ('active', 'archived'));

-- ------------------------------------------------------------
-- 7. class_teachers — 老师-班级关系（N:M）
-- ------------------------------------------------------------
CREATE TABLE class_teachers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id         uuid         NOT NULL,                         -- 逻辑关联 classes.id
  teacher_id       uuid         NOT NULL,                         -- 逻辑关联 users.id
  teacher_role_id  uuid,                                          -- 逻辑关联 teacher_roles.id，班级内角色（覆盖全局默认）
  joined_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_class_teachers_unique ON class_teachers(class_id, teacher_id);
CREATE INDEX idx_class_teachers_teacher ON class_teachers(teacher_id);

-- ------------------------------------------------------------
-- 8. class_students — 学生-班级关系（N:M）
-- ------------------------------------------------------------
CREATE TABLE class_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid         NOT NULL,                              -- 逻辑关联 classes.id
  student_id  uuid         NOT NULL,                              -- 逻辑关联 users.id
  group_name  varchar(50),
  status      varchar(20)  NOT NULL DEFAULT 'active',
  joined_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_class_students_unique ON class_students(class_id, student_id);
CREATE INDEX idx_class_students_student ON class_students(student_id);
CREATE INDEX idx_class_students_class_status ON class_students(class_id, status);

ALTER TABLE class_students ADD CONSTRAINT chk_class_students_status
  CHECK (status IN ('active', 'transferred', 'graduated'));

-- ------------------------------------------------------------
-- 9. parent_student_relations — 家长-学生绑定（N:M）
-- ------------------------------------------------------------
CREATE TABLE parent_student_relations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       uuid         NOT NULL,                          -- 逻辑关联 users.id
  student_id      uuid         NOT NULL,                          -- 逻辑关联 users.id
  relation_type   varchar(20)  NOT NULL,
  binding_status  varchar(20)  NOT NULL DEFAULT 'pending',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_parent_student_unique ON parent_student_relations(parent_id, student_id);
CREATE INDEX idx_parent_student_student ON parent_student_relations(student_id);
CREATE INDEX idx_parent_student_status ON parent_student_relations(binding_status);

ALTER TABLE parent_student_relations ADD CONSTRAINT chk_parent_student_relation
  CHECK (relation_type IN ('father', 'mother', 'guardian'));
ALTER TABLE parent_student_relations ADD CONSTRAINT chk_parent_student_binding
  CHECK (binding_status IN ('pending', 'active', 'revoked'));
ALTER TABLE parent_student_relations ADD CONSTRAINT chk_parent_not_student
  CHECK (parent_id != student_id);

-- ============================================================
-- 权限体系（v2.0 新增）
-- 角色和权限都是数据，不是代码硬编码
-- ============================================================

-- ------------------------------------------------------------
-- 10. teacher_roles — 老师职能角色定义
-- ------------------------------------------------------------
CREATE TABLE teacher_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid         NOT NULL,                             -- 逻辑关联 schools.id，每个学校独立定义
  name         varchar(50)  NOT NULL,                             -- 角色名称（主讲老师、助教老师）
  code         varchar(50)  NOT NULL,                             -- 角色编码（instructor、assistant）
  description  text,                                              -- 角色描述
  is_system    boolean      NOT NULL DEFAULT false,               -- 是否系统预置（不可删除）
  status       varchar(20)  NOT NULL DEFAULT 'active',            -- active / disabled
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_teacher_roles_school_code ON teacher_roles(school_id, code);
CREATE INDEX idx_teacher_roles_school ON teacher_roles(school_id);

ALTER TABLE teacher_roles ADD CONSTRAINT chk_teacher_roles_status
  CHECK (status IN ('active', 'disabled'));

-- ------------------------------------------------------------
-- 11. permissions — 权限定义
-- ------------------------------------------------------------
CREATE TABLE permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         varchar(50)  NOT NULL UNIQUE,                      -- 权限编码（class:create, task:assign）
  name         varchar(100) NOT NULL,                             -- 权限名称（创建班级、布置任务）
  scope        varchar(20)  NOT NULL,                             -- 权限作用域：global（学校级）/ class（班级级）
  category     varchar(50)  NOT NULL,                             -- 权限分类：class / student / task / report
  description  text,                                              -- 权限描述
  sort_order   integer      NOT NULL DEFAULT 0,                   -- 排序（后台展示用）
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- code 的 UNIQUE 约束自带索引（permissions_code_unique），无需额外建
CREATE INDEX idx_permissions_scope ON permissions(scope);
CREATE INDEX idx_permissions_category ON permissions(category);

ALTER TABLE permissions ADD CONSTRAINT chk_permissions_scope
  CHECK (scope IN ('global', 'class'));

-- ------------------------------------------------------------
-- 12. teacher_role_permissions — 角色-权限映射
-- ------------------------------------------------------------
CREATE TABLE teacher_role_permissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_role_id   uuid         NOT NULL,                        -- 逻辑关联 teacher_roles.id
  permission_id     uuid         NOT NULL,                        -- 逻辑关联 permissions.id
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_role_perms_unique ON teacher_role_permissions(teacher_role_id, permission_id);
CREATE INDEX idx_role_perms_role ON teacher_role_permissions(teacher_role_id);

-- ------------------------------------------------------------
-- 初始权限数据（Seed）
-- ------------------------------------------------------------

-- 权限定义（系统预置，所有学校共用）
INSERT INTO permissions (code, name, scope, category, sort_order) VALUES
  -- 班级管理（学校级）
  ('class:create',         '创建班级',       'global', 'class',   100),
  ('class:archive',        '归档班级',       'global', 'class',   101),
  ('class:assign_teacher', '分配班级老师',   'global', 'class',   102),
  -- 班级管理（班级级）
  ('class:edit',           '编辑班级信息',   'class',  'class',   200),
  -- 学生管理（班级级）
  ('student:add',          '添加学生',       'class',  'student', 300),
  ('student:view',         '查看学生',       'class',  'student', 301),
  ('student:edit',         '编辑学生信息',   'class',  'student', 302),
  ('student:remove',       '移除学生',       'class',  'student', 303),
  -- 家长管理（班级级）
  ('parent:add',           '添加家长',       'class',  'parent',  400),
  ('parent:view',          '查看家长',       'class',  'parent',  401),
  -- 任务管理（班级级）
  ('task:assign',          '布置任务',       'class',  'task',    500),
  ('task:view',            '查看任务',       'class',  'task',    501),
  -- 报表（分两级）
  ('report:school',        '查看全校报表',   'global', 'report',  600),
  ('report:class',         '查看班级报表',   'class',  'report',  601);
```

---

## 索引清单

| # | 表 | 索引名 | 类型 | 字段 |
|---|---|--------|------|------|
| 1 | schools | idx_schools_code | UNIQUE | code |
| 2 | users | idx_users_phone | UNIQUE | phone |
| 3 | users | idx_users_school_id | B-tree | school_id |
| 4 | users | idx_users_roles | GIN | roles |
| 5 | users | idx_users_status | B-tree | status |
| 6 | teacher_profiles | idx_teacher_profiles_user | UNIQUE | user_id |
| 7 | student_profiles | idx_student_profiles_user | UNIQUE | user_id |
| 8 | parent_profiles | idx_parent_profiles_user | UNIQUE | user_id |
| 9 | classes | idx_classes_school | B-tree | school_id |
| 10 | classes | idx_classes_school_status | B-tree | school_id, status |
| 11 | class_teachers | idx_class_teachers_unique | UNIQUE | class_id, teacher_id |
| 12 | class_teachers | idx_class_teachers_teacher | B-tree | teacher_id |
| 13 | class_students | idx_class_students_unique | UNIQUE | class_id, student_id |
| 14 | class_students | idx_class_students_student | B-tree | student_id |
| 15 | class_students | idx_class_students_class_status | B-tree | class_id, status |
| 16 | parent_student_relations | idx_parent_student_unique | UNIQUE | parent_id, student_id |
| 17 | parent_student_relations | idx_parent_student_student | B-tree | student_id |
| 18 | parent_student_relations | idx_parent_student_status | B-tree | binding_status |
| 19 | teacher_roles | idx_teacher_roles_school_code | UNIQUE | school_id, code |
| 20 | teacher_roles | idx_teacher_roles_school | B-tree | school_id |
| 21 | permissions | permissions_code_unique | UNIQUE(约束) | code |
| 22 | permissions | idx_permissions_scope | B-tree | scope |
| 23 | permissions | idx_permissions_category | B-tree | category |
| 24 | teacher_role_permissions | idx_role_perms_unique | UNIQUE | teacher_role_id, permission_id |
| 25 | teacher_role_permissions | idx_role_perms_role | B-tree | teacher_role_id |

## CHECK 约束清单

| # | 表 | 约束名 | 规则 |
|---|---|--------|------|
| 1 | schools | chk_schools_status | status IN ('active', 'suspended') |
| 2 | users | chk_users_phone_format | phone ~ '^\d{11}$' |
| 3 | users | chk_users_status | status IN ('active', 'pending_activation', 'inactive', 'suspended') |
| 4 | teacher_profiles | chk_teacher_employment | employment_status IN ('active', 'resigned') |
| 5 | student_profiles | chk_student_target_score | target_score IS NULL OR (0 <= target_score <= 9) |
| 6 | classes | chk_classes_stage | stage IS NULL OR IN ('foundation', 'intensive', 'sprint') |
| 7 | classes | chk_classes_status | status IN ('active', 'archived') |
| 8 | class_students | chk_class_students_status | status IN ('active', 'transferred', 'graduated') |
| 9 | parent_student_relations | chk_parent_student_relation | relation_type IN ('father', 'mother', 'guardian') |
| 10 | parent_student_relations | chk_parent_student_binding | binding_status IN ('pending', 'active', 'revoked') |
| 11 | parent_student_relations | chk_parent_not_student | parent_id != student_id |
| 12 | teacher_roles | chk_teacher_roles_status | status IN ('active', 'disabled') |
| 13 | permissions | chk_permissions_scope | scope IN ('global', 'class') |
