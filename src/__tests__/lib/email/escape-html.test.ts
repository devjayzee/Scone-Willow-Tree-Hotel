import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/email/escape-html";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("a<b")).toBe("a&lt;b");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a>b")).toBe("a&gt;b");
  });

  it("escapes double quote", () => {
    expect(escapeHtml('a"b')).toBe("a&quot;b");
  });

  it("escapes single quote", () => {
    expect(escapeHtml("a'b")).toBe("a&#39;b");
  });

  it("escapes a compound HTML injection payload", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
  });

  it("passes through an empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through a plain string unchanged", () => {
    expect(escapeHtml("Jane Smith")).toBe("Jane Smith");
  });

  it("escapes ampersand first so `&lt;` in input doesn't double-escape as `&amp;lt;`", () => {
    // Order matters: replace `&` before `<` so a literal `&` in input
    // becomes `&amp;`, not `&amp;amp;` after later passes. This test
    // pins that behaviour.
    expect(escapeHtml("&<")).toBe("&amp;&lt;");
  });
});
