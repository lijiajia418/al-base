# 响应时间轴

**Sprint**: Sprint 1
**状态**: pending

## 意图声明

- **改动意图**: 结果区域增加 3 家 Provider 的响应时间轴对比
- **影响范围**: `src/app/speech-realtime/page.tsx` — 结果展示区域
- **不变量**: 现有结果展示（分数、单词、JSON 详情）不变

## 产品需求来源

| 来源 | 链接 |
|------|------|
| Feature | [F-001-azure-display-mode](../../product/features/F-001-azure-display-mode/feature-scope.md) |
| User Story | [US-01-azure-waiting-state](../../product/features/F-001-azure-display-mode/stories/display-mode/US-01-azure-waiting-state/story.md) |

## 实现范围

三家均返回 final 结果后，展示响应时间轴：
- 记录每个 Provider 首次 intermediate 结果的时间戳（firstWordMs）和 final 结果的时间戳（finalMs）
- 讯飞/腾讯：显示首词时间 + 最终时间两个节点
- Azure：仅显示最终时间一个节点
- 时间基准：从 speech:start 事件发出时开始计时

需要在状态管理中增加时间戳记录逻辑。

## 实现步骤

### 前端

| 步骤 | 内容 | 涉及页面/模块 | DoD |
|------|------|-------------|-----|
| 1 | speech:start 时记录基准时间戳 | page.tsx 主组件 | startTime state 存在 |
| 2 | speech:result 回调中记录首词/最终时间 | page.tsx 主组件 | per-provider 时间戳记录 |
| 3 | 渲染时间轴组件 | page.tsx 结果区域 | 时间轴可见，数值正确 |

## DoD（完成定义）

### 实现类
- [ ] speech:start 时记录基准时间戳
- [ ] 每个 Provider 的首次 intermediate 和 final 结果时间戳被记录
- [ ] 结果区域渲染时间轴，讯飞/腾讯显示首词+最终时间，Azure 仅显示最终时间

### 测试类
- [ ] 变更点测试：三家结果到达后时间轴渲染正确，首词/最终时间值合理
- [ ] 影响范围回归：现有结果展示（分数卡片、单词列表、JSON 详情）不变

### 验证方式
- 对应测试用例: TC-01-05

## 回滚策略

移除时间戳记录逻辑和时间轴渲染组件。
