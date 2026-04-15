# 时间轴降级展示

**Sprint**: Sprint 1
**状态**: pending

## 意图声明

- **改动意图**: Provider 未返回结果时时间轴显示占位符而非报错
- **影响范围**: `src/app/speech-realtime/page.tsx` — 时间轴组件
- **不变量**: 已有结果的 Provider 时间轴展示不变

## 产品需求来源

| 来源 | 链接 |
|------|------|
| Feature | [F-001-azure-display-mode](../../product/features/F-001-azure-display-mode/feature-scope.md) |
| User Story | [US-01-azure-waiting-state](../../product/features/F-001-azure-display-mode/stories/display-mode/US-01-azure-waiting-state/story.md) |

## 实现范围

当某 Provider 未返回结果（超时/出错）时：
- 该 Provider 的时间轴行显示「—」占位符
- 不影响其他 Provider 的时间轴展示

## 实现步骤

### 前端

| 步骤 | 内容 | 涉及页面/模块 | DoD |
|------|------|-------------|-----|
| 1 | 时间轴组件增加 null 检查 | page.tsx 时间轴 | result=null 时显示「—」 |

## DoD（完成定义）

### 实现类
- [ ] Provider result 为 null 时时间轴该行显示「—」占位符

### 测试类
- [ ] 变更点测试：某 Provider result=null 时该行显示占位符，其他行正常
- [ ] 影响范围回归：所有 Provider 均有结果时时间轴展示不变

### 验证方式
- 对应测试用例: TC-01-06

## 回滚策略

移除 null 检查分支，恢复到仅处理有结果场景。
