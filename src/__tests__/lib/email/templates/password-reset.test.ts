import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const BASE_URL = "https://willowtree.example";

async function loadTemplate() {
  process.env.NEXTAUTH_URL = BASE_URL;
  vi.resetModules();
  const [{ passwordResetEmail }, { RESET_TOKEN_TTL_MINUTES }] =
    await Promise.all([
      import("@/lib/email/templates/password-reset"),
      import("@/lib/services/password-reset-service"),
    ]);
  return { passwordResetEmail, RESET_TOKEN_TTL_MINUTES };
}

describe("passwordResetEmail template", () => {
  const input = { firstName: "Jane", rawToken: "raw-token-abc" };

  beforeEach(() => {
    process.env.NEXTAUTH_URL = BASE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("has a stable subject line", async () => {
    const { passwordResetEmail } = await loadTemplate();
    expect(passwordResetEmail(input).subject).toBe(
      "Reset your Willow Tree password"
    );
  });

  it("embeds the raw token as a query param in text and html", async () => {
    const { passwordResetEmail } = await loadTemplate();
    const { text, html } = passwordResetEmail(input);
    const expectedUrl = `${BASE_URL}/reset-password?token=raw-token-abc`;
    expect(text).toContain(expectedUrl);
    expect(html).toContain(expectedUrl);
  });

  it("renders the TTL from RESET_TOKEN_TTL_MINUTES in text and html", async () => {
    const { passwordResetEmail, RESET_TOKEN_TTL_MINUTES } = await loadTemplate();
    const { text, html } = passwordResetEmail(input);
    expect(text).toContain(`${RESET_TOKEN_TTL_MINUTES} minutes`);
    expect(html).toContain(`${RESET_TOKEN_TTL_MINUTES} minutes`);
  });

  it("greets the recipient by first name in both bodies", async () => {
    const { passwordResetEmail } = await loadTemplate();
    const { text, html } = passwordResetEmail(input);
    expect(text).toContain("Hi Jane,");
    expect(html).toContain("Hi Jane,");
  });

  it("escapes HTML-unsafe characters in firstName in the html body", async () => {
    const { passwordResetEmail } = await loadTemplate();
    const { html } = passwordResetEmail({
      firstName: "<script>",
      rawToken: "raw-token-abc",
    });
    expect(html).toContain("Hi &lt;script&gt;,");
    expect(html).not.toContain("Hi <script>,");
  });
});
