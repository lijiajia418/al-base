# 前端单元测试规格 — F-001-azure-display-mode

---

## 组件渲染测试

| 测试点 | 输入 | 预期 |
|--------|------|------|
| ProviderPanel `mode="batch"` 等待态 | recording=true, result=null | 渲染脉冲动画 + 文案「录音结束后返回评测结果」，不渲染分数卡片数值 |
| ProviderPanel `mode="realtime"` 无变化 | recording=true, result=null | 与改动前行为一致（逐词亮起） |
| 模式标签 badge（batch） | mode="batch" | 灰色标签，文案「整句评测」 |
| 模式标签 badge（realtime） | mode="realtime" | 蓝色标签，文案「实时评测」 |

## 状态切换测试

| 测试点 | 触发 | 预期 |
|--------|------|------|
| recording→stopped 文案切换 | recording: true→false, result=null | 「录音结束后返回评测结果」→「评测中...」 |
| result 到达后退出等待态 | result 从 null → final payload | 正常显示分数和单词评测结果，等待态消失 |

## 时间轴测试

| 测试点 | 输入 | 预期 |
|--------|------|------|
| 有首词时间的 Provider | firstWordMs=320, finalMs=2100 | 显示首词 + 最终两个时间点 |
| 无首词时间的 Provider (Azure) | firstWordMs=null, finalMs=3800 | 仅显示最终时间点 |
| 结果未到达 | result=null | 该 Provider 行显示占位符「—」 |
