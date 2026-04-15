import { describe, it, expect } from "vitest";
import { success, error, ErrorCode } from "@/lib/api/response";

describe("API Response", () => {
  it("should format success response correctly", () => {
    const data = { id: "123", name: "test" };
    const res = success(data);

    expect(res).toEqual({
      code: 0,
      data: { id: "123", name: "test" },
      message: "success",
    });
  });

  it("should format error response with error code", () => {
    const res = error(ErrorCode.PHONE_FORMAT_ERROR, "手机号格式错误");

    expect(res).toEqual({
      code: 40001,
      data: null,
      message: "手机号格式错误",
    });
  });
});
