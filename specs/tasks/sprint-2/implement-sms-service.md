## implement-sms-service: 短信验证码服务

**所属 Feature：** F-002-user-system
**架构层级：** DOMAIN
**描述：** 实现验证码生成、Redis 存储、频率限制、校验逻辑。MVP 阶段短信发送用 console.log 模拟，后续对接阿里云 SMS。

**DoD：**
实现类：
- [ ] `src/domains/auth/sms-service.ts` 已创建
- [ ] `sendCode(phone)`: 生成6位码，存 Redis（TTL 5min），检查频率限制（60s冷却、日限10次）
- [ ] `verifyCode(phone, code)`: 校验验证码，失败计数，5次锁定30分钟
- [ ] Redis key 规则：`sms:code:{phone}`, `sms:cooldown:{phone}`, `sms:limit:{phone}`, `sms:lock:{phone}`
测试类：
- [ ] 变更点测试：sendCode 生成码 → verifyCode 校验通过 → 码被消耗（再次校验失败）
- [ ] 影响范围回归：无（新建代码）

**依赖：** setup-redis-client

**回滚策略：** 删除 `src/domains/auth/sms-service.ts`

**影响的文件：**
- src/domains/auth/sms-service.ts (新建)
