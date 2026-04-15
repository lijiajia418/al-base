# CLAUDE.md - al-base

**最后更新**: 2026-04-15 v2

---

## 项目概述

al-base 是一个基于 Next.js 15 + TypeScript 的教育平台基座，包含 WebSocket 实时通信框架、多厂商语音评测对比、LLM 客户端（Claude/Gemini）等模块。

---

## Build & Development Commands

| 用途 | 命令 |
|------|------|
| 安装依赖 | `npm install` |
| 开发服务器 | `npm run dev` |
| 构建 | `npm run build` |
| 测试 | `npm test` |
| Lint | `npm run lint` |
| 数据库迁移 | `npm run db:migrate` |

---

## SDD 流程

> 详见 [.claude/rules/sdd/](.claude/rules/sdd/)

流程概要: backlog → define-feature → write-story → design → plan-tasks → implement → code-review → verify

---

## 目录结构

```
specs/
├── backlog/       # 统一需求入口
├── product/       # PM: 需求与范围
├── ui/            # UI/UE: 界面设计
├── engineering/   # Dev: 架构与领域
├── test/          # QA: 验证与追溯
└── tasks/         # Sprint: 任务执行计划
```

---

## 可用 Skills

<!-- 常用命令速查：
     /sdd:setup           — 初始化项目
     /sdd:create-feature  — 创建新 Feature
     /sdd:resume          — 断点续作
     /sdd:progress        — 查看进度
     /sdd:check           — 一致性检查 -->

---

## 变更历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-02 | 1.0 | 初始版本，SDD 框架接入 |
