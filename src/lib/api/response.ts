export const ErrorCode = {
  // 400xx 参数错误
  PHONE_FORMAT_ERROR: 40001,
  INVALID_PARAMS: 40002,

  // 401xx 认证错误
  NO_TOKEN: 40101,
  TOKEN_EXPIRED: 40102,
  WRONG_CODE: 40103,
  CODE_EXPIRED: 40104,
  ACCOUNT_SUSPENDED: 40105,

  // 403xx 权限错误
  ROLE_NOT_ALLOWED: 40301,
  ROLE_NOT_ASSIGNED: 40302,
  PERMISSION_DENIED: 40303,
  RESOURCE_NOT_ACCESSIBLE: 40304,

  // 404xx 资源不存在
  USER_NOT_FOUND: 40401,
  CLASS_NOT_FOUND: 40402,
  ROLE_NOT_FOUND: 40403,

  // 409xx 冲突
  PHONE_ALREADY_EXISTS: 40901,
  ALREADY_IN_CLASS: 40902,
  ALREADY_BOUND: 40903,
  ROLE_CODE_EXISTS: 40904,

  // 429xx 限流
  SMS_COOLDOWN: 42901,
  SMS_DAILY_LIMIT: 42902,
  SMS_LOCKED: 42903,

  // 500xx 服务端错误
  SMS_SEND_FAILED: 50001,
  INTERNAL_ERROR: 50002,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

export function success<T>(data: T, message = "success"): ApiResponse<T> {
  return { code: 0, data, message };
}

export function error(code: ErrorCodeValue, message: string): ApiResponse<null> {
  return { code, data: null, message };
}
