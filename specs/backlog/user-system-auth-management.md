# 用户体系：认证与管理

**状态**: done
**完成日期**: 2026-04-09
**优先级**: P0
**创建日期**: 2026-04-06
**Feature**: F-002-user-system

## 需求描述

基于产品文档和用户体系全景设计，完成用户体系的认证闭环和管理功能，包括：

1. 手机号验证码登录系统（Token 签发、服务端验证、API 拦截器解耦）
2. 四种角色区分（school_admin / teacher / student / parent）
3. 权限系统（teacher_roles + permissions 数据驱动）
4. 组织管理（学校、班级、老师、学生、家长关系）
5. 35 个 RESTful API

## 关联文档

- `docs/A-Level 国际高中雅思课后 AI 教练系统.md` — 产品全景
- `docs/user-system-design.md` — 系统设计 v2.2
- `docs/api-design.md` — API 设计 v1.2
- `docs/database-schema.md` — 数据库 Schema v2.0
