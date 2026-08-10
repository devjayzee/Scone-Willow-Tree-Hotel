import { describe, it, expect } from "vitest";
import { emailSchema, normalizeEmail } from "@/lib/validations/email";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeEmail("  Jane@Example.COM \n")).toBe("jane@example.com");
  });

  it("is idempotent", () => {
    expect(normalizeEmail(normalizeEmail("Bob@Test.io"))).toBe("bob@test.io");
  });
});

describe("emailSchema", () => {
  it("normalizes mixed case + whitespace to the canonical form", () => {
    const result = emailSchema.parse("  Jane@Example.COM ");
    expect(result).toBe("jane@example.com");
  });

  it("rejects strings that aren't valid emails", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow();
    expect(() => emailSchema.parse("")).toThrow();
  });

  it("still rejects an all-whitespace value after trim", () => {
    expect(() => emailSchema.parse("   ")).toThrow();
  });
});
