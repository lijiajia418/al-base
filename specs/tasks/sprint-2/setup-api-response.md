## setup-api-response: 统一响应格式和错误码

**所属 Feature：** F-002-user-system
**架构层级：** SETUP
**描述：** 创建统一的 API 响应格式工具函数和错误码常量，所有 API 共用。

**DoD：**
实现类：
- [ ] `src/lib/api/response.ts` 已创建，导出 `success()` 和 `error()` 工具函数
- [ ] `src/lib/api/error-codes.ts` 已创建，定义错误码常量（40001-50001）
- [ ] 响应格式：`{ code: number, data: T | null, message: string }`
测试类：
- [ ] 变更点测试：success() 返回 `{ code: 0, data, message: "success" }`，error() 返回对应错误码
- [ ] 影响范围回归：无（新建代码）

**依赖：** 无

**回滚策略：** 删除 `src/lib/api/response.ts` 和 `error-codes.ts`

**影响的文件：**
- src/lib/api/response.ts (新建)
- src/lib/api/error-codes.ts (新建)
