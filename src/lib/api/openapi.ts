import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ─────────────────────────────────────────────
// 通用 Schema
// ─────────────────────────────────────────────

const ApiSuccessResponse = (dataSchema: z.ZodType, description: string) => ({
  description,
  content: { "application/json": { schema: z.object({ code: z.number(), data: dataSchema, message: z.string() }) } },
});

const ApiErrorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: z.object({ code: z.number(), data: z.null(), message: z.string() }) } },
});

// ─────────────────────────────────────────────
// 认证模块 (Auth)
// ─────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/sms-code",
  summary: "发送短信验证码",
  tags: ["认证"],
  request: {
    body: { content: { "application/json": { schema: z.object({
      phone: z.string().regex(/^\d{11}$/).openapi({ example: "13800001234", description: "11位手机号" }),
    }).openapi("SendCodeRequest") } } },
  },
  responses: {
    200: ApiSuccessResponse(z.object({ cooldown: z.number().openapi({ example: 60 }) }), "验证码发送成功"),
    400: ApiErrorResponse("手机号格式错误"),
    429: ApiErrorResponse("发送过于频繁 / 每日上限 / 已锁定"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  summary: "验证码登录",
  tags: ["认证"],
  request: {
    body: { content: { "application/json": { schema: z.object({
      phone: z.string().openapi({ example: "13800001234" }),
      code: z.string().openapi({ example: "123456", description: "6位验证码" }),
    }).openapi("LoginRequest") } } },
  },
  responses: {
    200: ApiSuccessResponse(z.object({
      token: z.string().openapi({ example: "a3f8c2e1-4b5d-..." }),
      user: z.object({
        id: z.string(), phone: z.string(), name: z.string(),
        roles: z.array(z.string()), schoolId: z.string(), status: z.string(),
      }),
      isNewUser: z.boolean(),
    }), "登录成功"),
    401: ApiErrorResponse("验证码错误 / 已过期"),
    429: ApiErrorResponse("验证失败次数过多"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  summary: "登出",
  tags: ["认证"],
  security: [{ bearerAuth: [] }],
  responses: { 200: ApiSuccessResponse(z.null(), "登出成功") },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  summary: "获取当前用户信息",
  tags: ["认证"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: ApiSuccessResponse(z.object({
      id: z.string(), phone: z.string(), name: z.string(), email: z.string().nullable(),
      avatarUrl: z.string().nullable(), roles: z.array(z.string()), activeRole: z.string(),
      schoolId: z.string(), schoolName: z.string().nullable(), status: z.string(),
      lastLoginAt: z.string().nullable(),
      profile: z.any().openapi({ description: "当前角色对应的 profile" }),
    }), "当前用户信息"),
    401: ApiErrorResponse("未认证"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/switch-role",
  summary: "切换角色",
  tags: ["认证"],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: z.object({
      role: z.string().openapi({ example: "parent", description: "目标角色" }),
    }).openapi("SwitchRoleRequest") } } },
  },
  responses: {
    200: ApiSuccessResponse(z.object({ activeRole: z.string() }), "切换成功"),
    403: ApiErrorResponse("不拥有该角色"),
  },
});

// ─────────────────────────────────────────────
// 用户模块 (Users)
// ─────────────────────────────────────────────

registry.registerPath({
  method: "put",
  path: "/api/v1/users/profile",
  summary: "更新个人信息",
  tags: ["用户"],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: z.object({
      name: z.string().optional().openapi({ example: "张小明" }),
      email: z.string().email().optional().openapi({ example: "zhang@example.com" }),
    }).openapi("UpdateProfileRequest") } } },
  },
  responses: { 200: ApiSuccessResponse(z.object({ id: z.string(), name: z.string(), email: z.string().nullable() }), "更新成功") },
});

// ─────────────────────────────────────────────
// 学校模块 (Schools)
// ─────────────────────────────────────────────

registry.registerPath({
  method: "get", path: "/api/v1/schools/current", summary: "获取当前学校信息", tags: ["学校"],
  security: [{ bearerAuth: [] }],
  responses: { 200: ApiSuccessResponse(z.object({
    id: z.string(), name: z.string(), code: z.string(), settings: z.any(), status: z.string(), createdAt: z.string(),
  }), "学校信息") },
});

registry.registerPath({
  method: "put", path: "/api/v1/schools/current", summary: "更新学校信息", tags: ["学校"],
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({
    name: z.string().optional(), settings: z.any().optional(),
  }).openapi("UpdateSchoolRequest") } } } },
  responses: { 200: ApiSuccessResponse(z.any(), "更新成功") },
});

registry.registerPath({
  method: "get", path: "/api/v1/schools/stats", summary: "学校统计概览", tags: ["学校"],
  security: [{ bearerAuth: [] }],
  responses: { 200: ApiSuccessResponse(z.object({
    teacherCount: z.number(), studentCount: z.number(), parentCount: z.number(),
    classCount: z.number(), activeClassCount: z.number(),
  }), "统计数据") },
});

// ─────────────────────────────────────────────
// 老师管理模块 (Teachers)
// ─────────────────────────────────────────────

registry.registerPath({
  method: "get", path: "/api/v1/teachers", summary: "老师列表", tags: ["老师管理"],
  security: [{ bearerAuth: [] }],
  request: { query: z.object({
    page: z.string().optional(), pageSize: z.string().optional(),
    status: z.string().optional(), keyword: z.string().optional(),
  }) },
  responses: { 200: ApiSuccessResponse(z.object({
    items: z.array(z.any()), total: z.number(), page: z.number(), pageSize: z.number(),
  }), "老师列表") },
});

registry.registerPath({
  method: "post", path: "/api/v1/teachers", summary: "添加老师", tags: ["老师管理"],
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({
    phone: z.string().openapi({ example: "13900001234" }),
    name: z.string().openapi({ example: "张老师" }),
    title: z.string().optional().openapi({ example: "IELTS老师" }),
    subjects: z.array(z.string()).optional().openapi({ example: ["IELTS"] }),
  }).openapi("AddTeacherRequest") } } } },
  responses: { 200: ApiSuccessResponse(z.any(), "添加成功"), 409: ApiErrorResponse("该用户已是老师") },
});

registry.registerPath({ method: "get", path: "/api/v1/teachers/{id}", summary: "老师详情", tags: ["老师管理"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.any(), "老师详情") } });
registry.registerPath({ method: "put", path: "/api/v1/teachers/{id}", summary: "编辑老师", tags: ["老师管理"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ name: z.string().optional(), title: z.string().optional(), subjects: z.array(z.string()).optional() }) } } } }, responses: { 200: ApiSuccessResponse(z.null(), "编辑成功") } });
registry.registerPath({ method: "put", path: "/api/v1/teachers/{id}/status", summary: "停用/启用/离职", tags: ["老师管理"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ action: z.enum(["suspend", "activate", "resign"]) }).openapi("TeacherStatusRequest") } } } }, responses: { 200: ApiSuccessResponse(z.null(), "操作成功") } });

// ─────────────────────────────────────────────
// 班级模块 (Classes)
// ─────────────────────────────────────────────

registry.registerPath({ method: "get", path: "/api/v1/classes", summary: "班级列表", tags: ["班级"], security: [{ bearerAuth: [] }], request: { query: z.object({ page: z.string().optional(), pageSize: z.string().optional(), grade: z.string().optional(), status: z.string().optional() }) }, responses: { 200: ApiSuccessResponse(z.any(), "班级列表") } });
registry.registerPath({ method: "post", path: "/api/v1/classes", summary: "创建班级", tags: ["班级"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ name: z.string().openapi({ example: "Year 12 IELTS A班" }), grade: z.string().optional(), academicYear: z.string().optional(), stage: z.string().optional(), primaryTeacherId: z.string().optional() }).openapi("CreateClassRequest") } } } }, responses: { 200: ApiSuccessResponse(z.any(), "创建成功") } });
registry.registerPath({ method: "get", path: "/api/v1/classes/{id}", summary: "班级详情", tags: ["班级"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.any(), "班级详情") } });
registry.registerPath({ method: "put", path: "/api/v1/classes/{id}", summary: "编辑班级", tags: ["班级"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.any(), "编辑成功") } });
registry.registerPath({ method: "put", path: "/api/v1/classes/{id}/status", summary: "归档/激活班级", tags: ["班级"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ action: z.enum(["archive", "activate"]) }) } } } }, responses: { 200: ApiSuccessResponse(z.null(), "操作成功") } });
registry.registerPath({ method: "post", path: "/api/v1/classes/{id}/teachers", summary: "分配老师到班级", tags: ["班级"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ teacherId: z.string(), teacherRoleId: z.string().optional() }).openapi("AssignTeacherRequest") } } } }, responses: { 200: ApiSuccessResponse(z.null(), "分配成功"), 409: ApiErrorResponse("已在班级") } });
registry.registerPath({ method: "delete", path: "/api/v1/classes/{id}/teachers/{teacherId}", summary: "移除班级老师", tags: ["班级"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.null(), "移除成功") } });

// ─────────────────────────────────────────────
// 学生模块 (Students)
// ─────────────────────────────────────────────

registry.registerPath({ method: "get", path: "/api/v1/classes/{classId}/students", summary: "班级学生列表", tags: ["学生"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.any(), "学生列表") } });
registry.registerPath({ method: "post", path: "/api/v1/classes/{classId}/students", summary: "添加学生到班级", tags: ["学生"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ phone: z.string().openapi({ example: "13600001234" }), name: z.string().openapi({ example: "王小明" }), grade: z.string().optional(), targetScore: z.number().optional(), examDate: z.string().optional(), groupName: z.string().optional() }).openapi("AddStudentRequest") } } } }, responses: { 200: ApiSuccessResponse(z.any(), "添加成功"), 409: ApiErrorResponse("已在班级") } });
registry.registerPath({ method: "get", path: "/api/v1/students/{id}", summary: "学生详情", tags: ["学生"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.any(), "学生详情") } });
registry.registerPath({ method: "put", path: "/api/v1/classes/{classId}/students/{studentId}", summary: "更新学生班级信息", tags: ["学生"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ groupName: z.string().optional(), status: z.string().optional() }) } } } }, responses: { 200: ApiSuccessResponse(z.null(), "更新成功") } });

// ─────────────────────────────────────────────
// 家长模块 (Parents)
// ─────────────────────────────────────────────

registry.registerPath({ method: "post", path: "/api/v1/students/{studentId}/parents", summary: "为学生添加家长", tags: ["家长"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ phone: z.string().openapi({ example: "13800005678" }), name: z.string().optional(), relationType: z.enum(["father", "mother", "guardian"]) }).openapi("AddParentRequest") } } } }, responses: { 200: ApiSuccessResponse(z.any(), "绑定成功"), 409: ApiErrorResponse("已绑定") } });
registry.registerPath({ method: "get", path: "/api/v1/students/{studentId}/parents", summary: "学生的家长列表", tags: ["家长"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.array(z.any()), "家长列表") } });
registry.registerPath({ method: "put", path: "/api/v1/parents/relations/{id}", summary: "更新家长绑定状态", tags: ["家长"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ bindingStatus: z.enum(["active", "revoked"]) }) } } } }, responses: { 200: ApiSuccessResponse(z.null(), "更新成功") } });
registry.registerPath({ method: "get", path: "/api/v1/parents/children", summary: "家长查看自己的孩子", tags: ["家长"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.array(z.any()), "孩子列表") } });

// ─────────────────────────────────────────────
// 角色权限模块 (Teacher Roles & Permissions)
// ─────────────────────────────────────────────

registry.registerPath({ method: "get", path: "/api/v1/teacher-roles", summary: "角色列表", tags: ["角色权限"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.array(z.any()), "角色列表") } });
registry.registerPath({ method: "post", path: "/api/v1/teacher-roles", summary: "创建角色", tags: ["角色权限"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ name: z.string().openapi({ example: "主讲老师" }), code: z.string().openapi({ example: "instructor" }), description: z.string().optional(), permissionIds: z.array(z.string()).optional() }).openapi("CreateRoleRequest") } } } }, responses: { 200: ApiSuccessResponse(z.any(), "创建成功"), 409: ApiErrorResponse("编码已存在") } });
registry.registerPath({ method: "get", path: "/api/v1/teacher-roles/{id}", summary: "角色详情（含权限）", tags: ["角色权限"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.any(), "角色详情") } });
registry.registerPath({ method: "put", path: "/api/v1/teacher-roles/{id}", summary: "编辑角色", tags: ["角色权限"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.any(), "编辑成功") } });
registry.registerPath({ method: "put", path: "/api/v1/teacher-roles/{id}/permissions", summary: "配置角色权限", tags: ["角色权限"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ permissionIds: z.array(z.string()) }).openapi("SetPermissionsRequest") } } } }, responses: { 200: ApiSuccessResponse(z.null(), "配置成功") } });
registry.registerPath({ method: "get", path: "/api/v1/permissions", summary: "获取所有可分配权限", tags: ["角色权限"], security: [{ bearerAuth: [] }], responses: { 200: ApiSuccessResponse(z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), scope: z.string(), category: z.string() })), "权限列表") } });

// ─────────────────────────────────────────────
// 生成 OpenAPI 文档
// ─────────────────────────────────────────────

export function generateOpenAPIDoc() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "A-Level AI 教练系统 API",
      version: "1.0.0",
      description: "用户体系 API — 认证、角色权限、组织管理",
    },
    servers: [{ url: "http://localhost:3000", description: "本地开发" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Token（登录后获取）" },
      },
    },
  } as any);
}
