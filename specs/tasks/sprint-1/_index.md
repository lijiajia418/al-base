# Sprint 1

**状态**: in_progress

## 任务索引

| Task | 名称 | 来源 PBI | 架构层级 | 依赖 | 状态 |
|------|------|---------|---------|------|------|
| add-provider-mode-badge | Provider 模式标签 | azure-display-mode | 表现层 | 无 | completed |
| add-azure-waiting-state | Azure 录音等待态 | azure-display-mode | 表现层 | add-provider-mode-badge | completed |
| add-azure-evaluating-state | Azure 评测中状态 | azure-display-mode | 表现层 | add-azure-waiting-state | completed |
| add-response-timeline | 响应时间轴 | azure-display-mode | 表现层 | 无 | completed |
| add-timeline-fallback | 时间轴降级展示 | azure-display-mode | 表现层 | add-response-timeline | completed |

## Sprint 目标

<!-- Sprint 关闭时根据实际完成的任务生成，创建时留空 -->

## DoD（Definition of Done）

- [ ] 所有任务状态为完成
- [ ] 主干测试通过
- [ ] 源文档已反哺更新
