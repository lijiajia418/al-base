# 代码审查报告：F-001-azure-display-mode

## 摘要

- 审查日期：2026-04-02
- 审查范围：Sprint 1（5 个 TASK，1 个文件：`src/app/speech-realtime/page.tsx`）
- MUST-FIX：0 项
- CONCERN：2 项
- POSITIVE：4 项

## 审查维度

### 1. 安全

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| page.tsx | 无用户输入注入风险（referenceText 来自预定义常量数组，非用户自由输入） | POSITIVE | — |
| page.tsx | WebSocket 连接未携带认证 token（`io({ reconnection: true })`） | — | 不在 F-001 范围（已有 Backlog 条目跟踪 WS 认证） |

### 2. 边界条件

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| page.tsx:442 | `mode === "batch" && (recording \|\| history.length > 0) && !result` 条件完整覆盖：录音中、录音结束未返回、结果返回后三态均有处理 | POSITIVE | — |
| page.tsx:582 | `allTimes` 为空时 `Math.max(...allTimes, 1)` 兜底值为 1，避免除零 | POSITIVE | — |
| page.tsx:108 | `firstWordMs: cur.firstWordMs ?? (payload.type === "intermediate" ? elapsed : cur.firstWordMs)` — Azure 只发 final，firstWordMs 保持 null，时间轴正确仅显示 finalMs | POSITIVE | — |

### 3. API 契约对齐

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| page.tsx | 前端 `SpeechResult` 接口与 `src/lib/ws/types.ts` 的 `SpeechIntermediatePayload` 字段完全一致（provider/type/scores/words/durationMs/raw） | — | 一致 |
| page.tsx | 前端重复定义了 `SpeechResult` 和 `SpeechWordResult` 类型，未从 `@/lib/ws/types` 导入 | CONCERN | 见下方说明 |

**CONCERN 说明**：`page.tsx` 自行定义了 `SpeechResult` 和 `SpeechWordResult`，与 `src/lib/ws/types.ts` 中的 `SpeechIntermediatePayload` 和 `SpeechWordResult` 结构一致但独立维护。作为 `"use client"` 组件无法直接导入服务端类型是合理的（Next.js 限制），但若字段变更需同步两处。建议未来考虑提取共享类型到 `src/types/` 目录。

### 4. 错误处理

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| page.tsx:225 | 麦克风获取失败有 catch + 用户提示 | — | 合理 |
| page.tsx:135 | WebSocket 未连接时提前返回 + 提示 | — | 合理 |

### 5. 依赖

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| page.tsx | 仅依赖 react、socket.io-client，均为已声明依赖 | — | 无问题 |

### 6. 架构一致性

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| page.tsx | 纯前端展示层改动，未触及后端逻辑或 Domain 层，符合 SDD-Lite 的"无架构变更"约束 | — | 一致 |
| page.tsx | `mode` 属性通过 prop 传入而非硬编码在组件内部，Provider 行为差异通过条件渲染实现 | — | 合理 |

### 7. 代码质量

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| page.tsx | 内联 style 较多（约 50+ 处），文件 662 行 | CONCERN | 见下方说明 |
| page.tsx | 组件拆分合理：`ProviderPanel`、`ResponseTimeline`、`MiniScore` 各司其职 | — | 合理 |
| page.tsx | `SAMPLE_SENTENCES` 和 `PROVIDER_LABELS` 提取为模块常量 | — | 合理 |

**CONCERN 说明**：内联 style 是页面创建时的既有模式，F-001 沿用了这一风格。作为 demo/对比页面可以接受，但若页面继续扩展建议迁移到 CSS Modules 或 Tailwind。不阻塞本次审查。

### 8. 测试质量

| 文件 | 发现 | 分类 | 状态 |
|------|------|------|------|
| 验收测试规格 | 6 个 TC 覆盖全部 5 个 AC，追溯矩阵完整 | — | 合理 |
| 前端单元测试规格 | 覆盖组件渲染、状态切换、时间轴三个维度 | — | 合理 |
| 自动化测试 | 42 个已有测试全部通过，无回归 | — | 通过 |

## MUST-FIX 修复记录

无 MUST-FIX 项。

## 结论

**通过**。

- 0 项 MUST-FIX，2 项 CONCERN（类型重复定义、内联样式）均为非阻塞建议
- 42 个已有测试全部通过，无回归
- Lint 错误均为 F-001 范围外的预存问题（`streaming-session.ts`、`speech-assessment/providers/`）
- 实现与验收测试规格对齐，5 个 AC 全覆盖
