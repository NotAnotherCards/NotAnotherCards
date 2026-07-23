import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "./auth";

describe("registerSchema", () => {
  it("passes with valid register input", () => {
    const result = registerSchema.safeParse({
      name: "test",
      username: "test_user",
      email: "test@example.com",
      password: "Password123*",
      confirmPassword: "Password123*",
    });

    expect(result.success).toBe(true);
  });

  it("fails with an invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Two",
      username: "test_user",
      email: "not-an-email",
      password: "Password123*",
      confirmPassword: "Password123*",
    });

    expect(result.success).toBe(false);
  });

  it("fails with a too-short password", () => {
    const result = registerSchema.safeParse({
      name: "Three",
      username: "test_user",
      email: "test@example.com",
      password: "Pass12*",
      confirmPassword: "Pass12*",
    });

    expect(result.success).toBe(false);
  });

  it("fails with an invalid password", () => {
    const result = registerSchema.safeParse({
      name: "Four",
      username: "test_user",
      email: "test@example.com",
      password: "thisisinvalid",
      confirmPassword: "thisisinvalid",
    });

    expect(result.success).toBe(false);
  });

  it("fails without a valid username", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      username: "not a public handle",
      email: "test@example.com",
      password: "Password123*",
      confirmPassword: "Password123*",
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
