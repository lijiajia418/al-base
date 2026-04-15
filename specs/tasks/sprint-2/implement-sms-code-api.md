## implement-sms-code-api: POST /auth/sms-code

**所属 Feature：** F-002-user-system
**架构层级：** API
**描述：** 实现发送短信验证码接口，校验手机号格式，调用 sms-service 发送验证码。

**DoD：**
实现类：
- [ ] `src/app/api/v1/auth/sms-code/route.ts` 已创建
- [ ] 接收 { phone }，校验 11 位手机号格式
- [ ] 调用 smsService.sendCode(phone)，返回 { cooldown: 60 }
- [ ] 白名单路由，不需要 Token
测试类：
- [ ] 变更点测试：有效手机号 → 返回 { code: 0, data: { cooldown: 60 } }
- [ ] 影响范围回归：无（新建代码）

**依赖：** implement-sms-service, implement-auth-interceptor

**回滚策略：** 删除 `src/app/api/v1/auth/sms-code/route.ts`

**影响的文件：**
- src/app/api/v1/auth/sms-code/route.ts (新建)
