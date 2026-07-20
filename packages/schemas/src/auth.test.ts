import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "./auth";

describe("registerSchema", () => {
  it("passes with valid register input", () => {
    const result = registerSchema.safeParse({
      name: "test",
      email: "test@example.com",
      password: "Password123*",
      confirmPassword: "Password123*",
    });

    expect(result.success).toBe(true);
  });

  it("fails with an invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Two",
      email: "not-an-email",
      password: "Password123*",
      confirmPassword: "Password123*",
    });

    expect(result.success).toBe(false);
  });

  it("fails with a too-short password", () => {
    const result = registerSchema.safeParse({
      name: "Three",
      email: "test@example.com",
      password: "Pass12*",
      confirmPassword: "Pass12*",
    });

    expect(result.success).toBe(false);
  });

  it("fails with an invalid password", () => {
    const result = registerSchema.safeParse({
      name: "Four",
      email: "test@example.com",
      password: "thisisinvalid",
      confirmPassword: "thisisinvalid",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("fails with an empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});
