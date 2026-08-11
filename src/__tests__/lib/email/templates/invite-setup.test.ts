import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const BASE_URL = "https://willowtree.example";

async function loadTemplate() {
  process.env.NEXTAUTH_URL = BASE_URL;
  vi.resetModules();
  const [{ inviteSetupEmail }, { SETUP_TOKEN_TTL_HOURS }] = await Promise.all([
    import("@/lib/email/templates/invite-setup"),
    import("@/lib/services/password-reset-service"),
  ]);
  return { inviteSetupEmail, SETUP_TOKEN_TTL_HOURS };
}

describe("inviteSetupEmail template", () => {
  const input = { firstName: "Alex", rawToken: "invite-token-xyz" };

  beforeEach(() => {
    process.env.NEXTAUTH_URL = BASE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("has a stable subject line", async () => {
    const { inviteSetupEmail } = await loadTemplate();
    expect(inviteSetupEmail(input).subject).toBe(
      "You're invited to the Willow Tree team"
    );
  });

  it("embeds the raw token as a query param in text and html", async () => {
    const { inviteSetupEmail } = await loadTemplate();
    const { text, html } = inviteSetupEmail(input);
    const expectedUrl = `${BASE_URL}/setup-password?token=invite-token-xyz`;
    expect(text).toContain(expectedUrl);
    expect(html).toContain(expectedUrl);
  });

  it("renders the TTL from SETUP_TOKEN_TTL_HOURS in text and html", async () => {
    const { inviteSetupEmail, SETUP_TOKEN_TTL_HOURS } = await loadTemplate();
    const { text, html } = inviteSetupEmail(input);
    expect(text).toContain(`${SETUP_TOKEN_TTL_HOURS} hours`);
    expect(html).toContain(`${SETUP_TOKEN_TTL_HOURS} hours`);
  });

  it("greets the recipient by first name in both bodies", async () => {
    const { inviteSetupEmail } = await loadTemplate();
    const { text, html } = inviteSetupEmail(input);
    expect(text).toContain("Hi Alex,");
    expect(html).toContain("Hi Alex,");
  });

  it("escapes HTML-unsafe characters in firstName in the html body", async () => {
    const { inviteSetupEmail } = await loadTemplate();
    const { html } = inviteSetupEmail({
      firstName: "<script>",
      rawToken: "invite-token-xyz",
    });
    expect(html).toContain("Hi &lt;script&gt;,");
    expect(html).not.toContain("Hi <script>,");
  });
});
