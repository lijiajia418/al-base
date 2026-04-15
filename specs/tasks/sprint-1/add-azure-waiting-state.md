# Azure 录音等待态

**Sprint**: Sprint 1
**状态**: pending

## 意图声明

- **改动意图**: mode=batch 的 ProviderPanel 在录音期间显示等待态 UI 替代空白
- **影响范围**: `src/app/speech-realtime/page.tsx` — ProviderPanel 分数区域 + 单词区域
- **不变量**: mode=realtime 的 ProviderPanel 行为完全不变

## 产品需求来源

| 来源 | 链接 |
|------|------|
| Feature | [F-001-azure-display-mode](../../product/features/F-001-azure-display-mode/feature-scope.md) |
| User Story | [US-01-azure-waiting-state](../../product/features/F-001-azure-display-mode/stories/display-mode/US-01-azure-waiting-state/story.md) |

## 实现范围

当 `mode="batch"` 且 `recording=true` 且 `result=null` 时：
- 分数区域：隐藏 "—" 数值，显示脉冲动画 + 文案「录音结束后返回评测结果」
- 单词区域：所有参考词保持灰色，整体呼吸灯效果（区别于 realtime 的逐词蓝色脉冲）

## 实现步骤

### 前端

| 步骤 | 内容 | 涉及页面/模块 | DoD |
|------|------|-------------|-----|
| 1 | 分数卡片区域条件渲染：batch 等待态 vs 正常分数 | page.tsx ProviderPanel | batch+recording 时显示等待文案 |
| 2 | 单词区域条件渲染：batch 呼吸灯 vs realtime 逐词脉冲 | page.tsx ProviderPanel | batch 时全词灰色+呼吸灯 |
| 3 | CSS 脉冲/呼吸灯 keyframe | page.tsx 或 globals.css | 动画可见 |

## DoD（完成定义）

### 实现类
- [ ] mode=batch + recording 时分数区域显示脉冲动画 + 文案「录音结束后返回评测结果」
- [ ] mode=batch + recording 时单词区域显示整体呼吸灯效果

### 测试类
- [ ] 变更点测试：ProviderPanel mode="batch" recording=true result=null 时渲染等待态 UI（脉冲动画+文案+呼吸灯）
- [ ] 影响范围回归：mode="realtime" 的 ProviderPanel 渲染行为无变化

### 验证方式
- 对应测试用例: TC-01-01

## 回滚策略

移除分数区域和单词区域的条件分支，恢复原始渲染逻辑。
