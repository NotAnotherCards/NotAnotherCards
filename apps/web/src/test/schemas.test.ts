import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@repo/schemas";

describe("@repo/schemas wiring", () => {
  it("imports and validates auth schemas", () => {
    expect(
      loginSchema.safeParse({
        email: "test@example.com",
        password: "secret",
      }).success,
    ).toBe(true);

    expect(
      registerSchema.safeParse({
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "Password123*",
        confirmPassword: "Password123*",
      }).success,
    ).toBe(true);
  });
});
