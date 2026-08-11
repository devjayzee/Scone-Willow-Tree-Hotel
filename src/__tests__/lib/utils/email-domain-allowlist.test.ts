import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAllowedRecipientDomain } from "@/lib/utils/email-domain-allowlist";

const ORIGINAL = process.env.INVITE_DOMAIN_ALLOWLIST;

describe("isAllowedRecipientDomain", () => {
  beforeEach(() => {
    delete process.env.INVITE_DOMAIN_ALLOWLIST;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.INVITE_DOMAIN_ALLOWLIST;
    } else {
      process.env.INVITE_DOMAIN_ALLOWLIST = ORIGINAL;
    }
  });

  it("allows anything when the env var is unset", () => {
    expect(isAllowedRecipientDomain("anyone@example.com")).toBe(true);
    expect(isAllowedRecipientDomain("attacker@evil.example")).toBe(true);
  });

  it("allows anything when the env var is an empty string", () => {
    process.env.INVITE_DOMAIN_ALLOWLIST = "";
    expect(isAllowedRecipientDomain("anyone@example.com")).toBe(true);
  });

  it("allows only matching domains when the env var is set", () => {
    process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.com";
    expect(isAllowedRecipientDomain("staff@hotel.com")).toBe(true);
    expect(isAllowedRecipientDomain("attacker@evil.example")).toBe(false);
  });

  it("supports multiple comma-separated domains", () => {
    process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.com, partner.example";
    expect(isAllowedRecipientDomain("bob@hotel.com")).toBe(true);
    expect(isAllowedRecipientDomain("alice@partner.example")).toBe(true);
    expect(isAllowedRecipientDomain("mallory@evil.example")).toBe(false);
  });

  it("matches case-insensitively for both env value and email", () => {
    process.env.INVITE_DOMAIN_ALLOWLIST = "Hotel.Com";
    expect(isAllowedRecipientDomain("Someone@HOTEL.com")).toBe(true);
  });

  it("does not match subdomains implicitly", () => {
    process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.com";
    expect(isAllowedRecipientDomain("staff@sub.hotel.com")).toBe(false);
  });

  it("rejects malformed emails when an allowlist is set", () => {
    process.env.INVITE_DOMAIN_ALLOWLIST = "hotel.com";
    expect(isAllowedRecipientDomain("not-an-email")).toBe(false);
    expect(isAllowedRecipientDomain("")).toBe(false);
    expect(isAllowedRecipientDomain("trailing@")).toBe(false);
  });
});
