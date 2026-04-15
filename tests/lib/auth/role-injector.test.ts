import { describe, it, expect } from "vitest";
import { resolveActiveRole } from "@/lib/auth/role-injector";
import type { AuthContext } from "@/lib/auth/auth-interceptor";

describe("RoleInjector", () => {
  it("should use X-Active-Role header when provided and valid", () => {
    const auth: AuthContext = {
      userId: "u-001",
      phone: "13800001234",
      roles: ["teacher", "parent"],
      schoolId: "s-001",
      activeRole: "teacher",
    };

    const result = resolveActiveRole(auth, "parent");

    expect(result.success).toBe(true);
    expect(result.activeRole).toBe("parent");
  });

  it("should fall back to session activeRole when header is not provided", () => {
    const auth: AuthContext = {
      userId: "u-001",
      phone: "13800001234",
      roles: ["teacher", "parent"],
      schoolId: "s-001",
      activeRole: "teacher",
    };

    const result = resolveActiveRole(auth, undefined);

    expect(result.success).toBe(true);
    expect(result.activeRole).toBe("teacher");
  });

  it("should fall back to roles[0] when session activeRole is empty", () => {
    const auth: AuthContext = {
      userId: "u-001",
      phone: "13800001234",
      roles: ["student"],
      schoolId: "s-001",
      activeRole: "",
    };

    const result = resolveActiveRole(auth, undefined);

    expect(result.success).toBe(true);
    expect(result.activeRole).toBe("student");
  });

  it("should reject when requested role is not in user roles", () => {
    const auth: AuthContext = {
      userId: "u-001",
      phone: "13800001234",
      roles: ["student"],
      schoolId: "s-001",
      activeRole: "student",
    };

    const result = resolveActiveRole(auth, "teacher");

    expect(result.success).toBe(false);
    expect(result.error).toBe("ROLE_NOT_ASSIGNED");
  });
});
