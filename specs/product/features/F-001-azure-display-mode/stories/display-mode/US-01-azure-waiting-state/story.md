# Azure 评测等待态与模式标签

**US ID**: US-01-azure-waiting-state
**所属分组**: display-mode
**状态**: draft

---

## User Story

**作为** 语音评测对比工具的使用者
**我想要** 在录音期间看到 Azure 列的等待状态说明和各 Provider 的评测模式标签
**以便于** 我能理解 Azure 与其他两家的评测模式差异，不会误以为 Azure 连接失败

---

## 验收标准

1. Given 录音进行中，讯飞/腾讯已开始返回中间结果
   When 我查看 Azure 列
   Then 分数区域显示脉冲动画 + 文案「录音结束后返回评测结果」，单词区域显示整体呼吸灯效果

2. Given 录音结束，Azure 尚未返回结果
   When 我查看 Azure 列
   Then 文案切换为「评测中...」

3. Given 页面加载完成
   When 我查看三列 Provider 卡片标题
   Then 讯飞/腾讯显示蓝色「实时评测」标签，Azure 显示灰色「整句评测」标签

4. Given 三家均返回最终结果
   When 我查看结果区域
   Then 能看到响应时间轴，包含各 Provider 的首词时间（如有）和最终结果时间

5. Given 讯飞/腾讯正在流式返回中间结果
   When Azure 列处于等待态
   Then 讯飞/腾讯的逐词亮起行为不受任何影响

---

## 约束与假设

**约束**：
- 不伪造 Azure 中间结果
- 不改后端逻辑
- 不改变 SpeechIntermediatePayload 接口

**假设**：
- Azure 始终只返回一次 final 结果（已通过 API 调研确认）
- 讯飞/腾讯的 intermediate 事件携带 words 数组用于逐词展示
