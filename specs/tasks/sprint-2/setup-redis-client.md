## setup-redis-client: Redis 客户端初始化

**所属 Feature：** F-002-user-system
**架构层级：** SETUP
**描述：** 创建 Redis 客户端封装，提供连接池和基础操作方法，供 SMS 验证码、Token 会话等模块使用。

**DoD：**
实现类：
- [ ] `src/lib/redis/index.ts` 已创建，导出 Redis 客户端实例
- [ ] 支持 `get/set/del/expire/ttl` 基础操作
- [ ] 从 `REDIS_URL` 环境变量读取连接配置
测试类：
- [ ] 变更点测试：Redis set → get → del 操作返回正确结果
- [ ] 影响范围回归：无（新建代码）

**依赖：** 无

**回滚策略：** 删除 `src/lib/redis/` 目录

**影响的文件：**
- src/lib/redis/index.ts (新建)
