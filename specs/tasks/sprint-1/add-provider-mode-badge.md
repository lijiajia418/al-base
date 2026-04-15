# Provider 模式标签

**Sprint**: Sprint 1
**状态**: pending

## 意图声明

- **改动意图**: ProviderPanel 组件增加 `mode` prop，标题旁显示评测模式标签
- **影响范围**: `src/app/speech-realtime/page.tsx` — ProviderPanel 组件
- **不变量**: 讯飞/腾讯列的现有渲染行为不变

## 产品需求来源

| 来源 | 链接 |
|------|------|
| Feature | [F-001-azure-display-mode](../../product/features/F-001-azure-display-mode/feature-scope.md) |
| User Story | [US-01-azure-waiting-state](../../product/features/F-001-azure-display-mode/stories/display-mode/US-01-azure-waiting-state/story.md) |

## 实现范围

ProviderPanel 接受新的 `mode: "realtime" | "batch"` prop。标题区域渲染 badge：
- `realtime` → 蓝色背景 `实时评测`
- `batch` → 灰色背景 `整句评测`

调用处传参：Azure 传 `mode="batch"`，讯飞/腾讯传 `mode="realtime"`。

## 实现步骤

### 前端

| 步骤 | 内容 | 涉及页面/模块 | DoD |
|------|------|-------------|-----|
| 1 | ProviderPanel 增加 `mode` prop 定义 | page.tsx ProviderPanel | prop 类型声明存在 |
| 2 | 标题区域渲染 badge | page.tsx ProviderPanel | badge 按 mode 显示正确颜色和文案 |
| 3 | 三处调用传入 mode | page.tsx 主组件 | Azure=batch, 讯飞/腾讯=realtime |

## DoD（完成定义）

### 实现类
- [ ] ProviderPanel 接受 `mode: "realtime" | "batch"` prop
- [ ] 标题旁渲染 badge，realtime=蓝色「实时评测」，batch=灰色「整句评测」

### 测试类
- [ ] 变更点测试：ProviderPanel mode="batch" 渲染灰色「整句评测」标签；mode="realtime" 渲染蓝色「实时评测」标签
- [ ] 影响范围回归：讯飞/腾讯列渲染结果无变化

### 验证方式
- 对应测试用例: TC-01-04

## 回滚策略

删除 mode prop 及 badge 渲染代码，恢复原 ProviderPanel 签名。
