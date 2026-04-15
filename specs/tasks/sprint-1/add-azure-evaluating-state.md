# Azure 评测中状态

**Sprint**: Sprint 1
**状态**: pending

## 意图声明

- **改动意图**: 录音停止后、Azure 结果返回前，文案从等待态切换为「评测中...」
- **影响范围**: `src/app/speech-realtime/page.tsx` — ProviderPanel 分数区域
- **不变量**: 等待态和最终结果态的渲染不变

## 产品需求来源

| 来源 | 链接 |
|------|------|
| Feature | [F-001-azure-display-mode](../../product/features/F-001-azure-display-mode/feature-scope.md) |
| User Story | [US-01-azure-waiting-state](../../product/features/F-001-azure-display-mode/stories/display-mode/US-01-azure-waiting-state/story.md) |

## 实现范围

当 `mode="batch"` 且 `recording=false` 且 `result=null` 时：
- 分数区域文案切换为「评测中...」，脉冲动画继续

状态转换：`录音中（等待态）` → `停止录音（评测中）` → `结果到达（正常展示）`

## 实现步骤

### 前端

| 步骤 | 内容 | 涉及页面/模块 | DoD |
|------|------|-------------|-----|
| 1 | 分数区域增加 recording=false + result=null 分支 | page.tsx ProviderPanel | 文案显示「评测中...」 |

## DoD（完成定义）

### 实现类
- [ ] mode=batch + recording=false + result=null 时文案显示「评测中...」，脉冲动画继续

### 测试类
- [ ] 变更点测试：ProviderPanel 从 recording=true 切换到 recording=false 且 result=null 时，文案变为「评测中...」
- [ ] 影响范围回归：等待态（recording=true）和结果态（result!=null）渲染不变

### 验证方式
- 对应测试用例: TC-01-03

## 回滚策略

移除 recording=false 条件分支，合并回等待态逻辑。
