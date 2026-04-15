# Backlog

> 统一的需求管理入口。所有需求、想法、反馈、Bug 在此登记和流转。

## 状态说明

条目通过状态字段流转，对应三层过滤逻辑：

| 状态 | 对应层级 | 含义 |
|------|---------|------|
| `idea` | Layer 0 | 刚记录，未评估 |
| `triaged` | Layer 0→1 | 已评估分级，待决策是否值得做 |
| `ready` | Layer 1 | 确认值得做，可排期 |
| `scheduled` | Layer 1→2 | 已排入某个 Sprint |
| `done` | 完成 | 已完成 |
| `discarded` | 丢弃 | 已丢弃或合并到其他条目 |

## 命名规范

条目使用**语义 slug** 命名（非顺序编号），避免多人/多 session 并行时的 ID 碰撞。

- 文件名格式：`{语义描述}.md`（小写英文，连字符分隔）
- 示例：`validate-boundary.md`、`solo-mode-testing.md`
- 命名原则：简短、自描述、唯一

## 优先级与并行规则

### 优先级含义

- **P 值越小越先做**：P1 必须在 P2 之前完成
- **同一 P 值内看并行标记**

### 并行判断条件

两个项目满足以下**全部条件**才可并行执行：
1. 不修改同一批文件（无文件冲突）
2. 不依赖对方的产出（无数据依赖）
3. 各自的验证可独立完成（无测试耦合）

## 查看条目

```bash
# 查看所有条目
ls specs/backlog/*.md | grep -v _index | grep -v template

# 按状态过滤（示例）
grep -l "| 状态 | idea |" specs/backlog/*.md
grep -l "| 状态 | ready |" specs/backlog/*.md
```
