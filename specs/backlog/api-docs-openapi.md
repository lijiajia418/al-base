# API 文档自动生成（OpenAPI + Scalar）

**状态**: done
**完成日期**: 2026-04-09
**优先级**: P1
**Feature**: 基础设施增强（不单独建 Feature，作为 Enhancement 直接实现）

## 需求描述

接入 zod-to-openapi + Scalar，实现 API 文档自动生成和在线浏览。

## 知识吸收去向

- src/lib/api/openapi.ts — OpenAPI 注册中心
- src/app/api/docs/route.ts — OpenAPI JSON 端点
- src/app/api-docs/page.tsx — Scalar 文档页面
