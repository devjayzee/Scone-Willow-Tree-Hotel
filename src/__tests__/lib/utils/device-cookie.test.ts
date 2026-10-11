import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac, hkdfSync } from "node:crypto";
import {
  DEVICE_COOKIE_MAX_AGE,
  DEVICE_COOKIE_MAX_ENTRIES,
} from "@/lib/constants/auth";

type DeviceCookieModule = typeof import("@/lib/utils/device-cookie");

const SECRET = "test-secret-for-device-cookie-0123456789";
const T = 1_800_000_000; // fixed "now" in Unix seconds; no fake timers needed
const EMAIL = "victim@example.com";

// The cookie name and flags are computed at module load from NEXTAUTH_URL,
// and the key comes from NEXTAUTH_SECRET, so every test imports a fresh copy.
async function load(
  opts: { secret?: string; url?: string } = {},
): Promise<DeviceCookieModule> {
  vi.resetModules();
  vi.stubEnv("NEXTAUTH_SECRET", opts.secret ?? SECRET);
  vi.stubEnv("NEXTAUTH_URL", opts.url ?? "http://localhost:3000");
  return import("@/lib/utils/device-cookie");
}

const entriesOf = (value: string) => value.split("~");
const parts = (entry: string) => {
  const [nonce, iat, sig] = entry.split(".");
  return { nonce, iat: Number(iat), sig };
};

describe("device-cookie", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("name and options", () => {
    it("uses wt-device and a non-secure cookie on http", async () => {
      const m = await load({ url: "http://localhost:3000" });

      expect(m.DEVICE_COOKIE_NAME).toBe("wt-device");
      expect(m.DEVICE_COOKIE_OPTIONS).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        path: "/",
        maxAge: 15_552_000,
      });
    });

    it("uses __Host-wt-device and a Secure cookie on https", async () => {
      const m = await load({ url: "https://hotel.example.com" });

      expect(m.DEVICE_COOKIE_NAME).toBe("__Host-wt-device");
      expect(m.DEVICE_COOKIE_OPTIONS).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 15_552_000,
      });
    });
  });

  describe("issueDeviceCookie / findTrustedDevice", () => {
    it("issues a cookie that is accepted back for the same email", async () => {
      const m = await load();

      const value = m.issueDeviceCookie(undefined, EMAIL, T);
      const nonce = m.findTrustedDevice(value, EMAIL, T);

      expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes, base64url
      expect(parts(entriesOf(value)[0]).nonce).toBe(nonce);
    });

    it("formats an entry as <nonce>.<iat>.<sig> with a 32-byte base64url sig", async () => {
      const m = await load();

      const value = m.issueDeviceCookie(undefined, EMAIL, T);

      expect(entriesOf(value)).toHaveLength(1);
      const { iat, sig } = parts(value);
      expect(iat).toBe(T);
      expect(sig).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("never puts the email, or its encodings, in the cookie", async () => {
      const m = await load();

      const value = m.issueDeviceCookie(undefined, EMAIL, T);

      expect(value).not.toContain(EMAIL);
      expect(value).not.toContain("victim");
      expect(value).not.toContain(Buffer.from(EMAIL).toString("base64url"));
      expect(value).not.toContain(Buffer.from(EMAIL).toString("base64"));
      expect(value).not.toContain(encodeURIComponent(EMAIL));
    });

    it("accepts an entry minted independently from the documented format", async () => {
      const m = await load();
      const nonce = "AAAAAAAAAAAAAAAAAAAAAA";
      const key = Buffer.from(hkdfSync("sha256", SECRET, "", "wt-device-cookie-v1", 32));
      const sig = createHmac("sha256", key)
        .update(`wt-device.v1|${EMAIL}|${nonce}|${T}`)
        .digest("base64url");

      expect(m.findTrustedDevice(`${nonce}.${T}.${sig}`, EMAIL, T)).toBe(nonce);
    });

    it("mints a different nonce for each fresh device", async () => {
      const m = await load();

      const a = m.issueDeviceCookie(undefined, EMAIL, T);
      const b = m.issueDeviceCookie(undefined, EMAIL, T);

      expect(parts(a).nonce).not.toBe(parts(b).nonce);
    });

    it("keeps the same nonce on refresh and refreshes iat without duplicating the entry", async () => {
      const m = await load();
      const first = m.issueDeviceCookie(undefined, EMAIL, T);
      const nonce = m.findTrustedDevice(first, EMAIL, T);

      const refreshed = m.issueDeviceCookie(first, EMAIL, T + 1000);

      expect(entriesOf(refreshed)).toHaveLength(1);
      expect(m.findTrustedDevice(refreshed, EMAIL, T + 1000)).toBe(nonce);
      expect(parts(refreshed).iat).toBe(T + 1000);
    });

    it("keeps other users' entries, newest first", async () => {
      const m = await load();
      const a = m.issueDeviceCookie(undefined, "a@example.com", T);
      const ab = m.issueDeviceCookie(a, "b@example.com", T + 10);

      expect(entriesOf(ab)).toHaveLength(2);
      expect(parts(entriesOf(ab)[0]).iat).toBe(T + 10);
      expect(m.findTrustedDevice(ab, "a@example.com", T + 10)).not.toBeNull();
      expect(m.findTrustedDevice(ab, "b@example.com", T + 10)).not.toBeNull();
    });

    it("moves a refreshed entry to the front", async () => {
      const m = await load();
      const a = m.issueDeviceCookie(undefined, "a@example.com", T);
      const ab = m.issueDeviceCookie(a, "b@example.com", T + 10);

      const aba = m.issueDeviceCookie(ab, "a@example.com", T + 20);

      expect(entriesOf(aba)).toHaveLength(2);
      expect(parts(entriesOf(aba)[0]).iat).toBe(T + 20);
      expect(m.findTrustedDevice(aba, "a@example.com", T + 20)).toBe(
        m.findTrustedDevice(a, "a@example.com", T),
      );
    });

    it(`keeps at most ${DEVICE_COOKIE_MAX_ENTRIES} entries, dropping the oldest`, async () => {
      const m = await load();
      let value: string | undefined;
      const emails = Array.from({ length: 12 }, (_, i) => `u${i}@example.com`);
      emails.forEach((e, i) => {
        value = m.issueDeviceCookie(value, e, T + i);
      });

      expect(entriesOf(value!)).toHaveLength(DEVICE_COOKIE_MAX_ENTRIES);
      expect(parts(entriesOf(value!)[0]).iat).toBe(T + 11);
      expect(m.findTrustedDevice(value, emails[11], T + 11)).not.toBeNull();
      expect(m.findTrustedDevice(value, emails[2], T + 11)).not.toBeNull();
      expect(m.findTrustedDevice(value, emails[1], T + 11)).toBeNull();
      expect(m.findTrustedDevice(value, emails[0], T + 11)).toBeNull();
    });

    it("drops expired entries when issuing", async () => {
      const m = await load();
      const old = m.issueDeviceCookie(undefined, "old@example.com", T);

      const later = T + DEVICE_COOKIE_MAX_AGE + 1;
      const value = m.issueDeviceCookie(old, EMAIL, later);

      expect(entriesOf(value)).toHaveLength(1);
      expect(m.findTrustedDevice(value, "old@example.com", later)).toBeNull();
    });

    it("replaces a garbage old value with a single valid entry", async () => {
      const m = await load();

      const value = m.issueDeviceCookie("not-a-cookie~~x.y", EMAIL, T);

      expect(entriesOf(value)).toHaveLength(1);
      expect(m.findTrustedDevice(value, EMAIL, T)).not.toBeNull();
    });
  });

  describe("findTrustedDevice rejects", () => {
    it("an entry minted for a different email", async () => {
      const m = await load();
      const value = m.issueDeviceCookie(undefined, "other@example.com", T);

      expect(m.findTrustedDevice(value, EMAIL, T)).toBeNull();
    });

    it("a tampered signature", async () => {
      const m = await load();
      const { nonce, iat, sig } = parts(m.issueDeviceCookie(undefined, EMAIL, T));
      const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);

      expect(m.findTrustedDevice(`${nonce}.${iat}.${flipped}`, EMAIL, T)).toBeNull();
    });

    it("a tampered iat (the signature covers it)", async () => {
      const m = await load();
      const { nonce, iat, sig } = parts(m.issueDeviceCookie(undefined, EMAIL, T));

      expect(m.findTrustedDevice(`${nonce}.${iat + 1}.${sig}`, EMAIL, T + 5)).toBeNull();
    });

    it("a tampered nonce", async () => {
      const m = await load();
      const { nonce, iat, sig } = parts(m.issueDeviceCookie(undefined, EMAIL, T));
      const other = (nonce[0] === "A" ? "B" : "A") + nonce.slice(1);

      expect(m.findTrustedDevice(`${other}.${iat}.${sig}`, EMAIL, T)).toBeNull();
    });

    it("a cookie signed under a different NEXTAUTH_SECRET (rotation revokes devices)", async () => {
      const before = await load({ secret: "first-secret-first-secret-first-secret" });
      const value = before.issueDeviceCookie(undefined, EMAIL, T);
      expect(before.findTrustedDevice(value, EMAIL, T)).not.toBeNull();

      const after = await load({ secret: "other-secret-other-secret-other-secret" });

      expect(after.findTrustedDevice(value, EMAIL, T)).toBeNull();
    });

    it("an entry older than the max age, but accepts it exactly at the max age", async () => {
      const m = await load();
      const value = m.issueDeviceCookie(undefined, EMAIL, T);

      expect(m.findTrustedDevice(value, EMAIL, T + DEVICE_COOKIE_MAX_AGE)).not.toBeNull();
      expect(m.findTrustedDevice(value, EMAIL, T + DEVICE_COOKIE_MAX_AGE + 1)).toBeNull();
    });

    it("an iat more than 60s in the future, but accepts 60s of clock skew", async () => {
      const m = await load();
      const value = m.issueDeviceCookie(undefined, EMAIL, T);

      expect(m.findTrustedDevice(value, EMAIL, T - 60)).not.toBeNull();
      expect(m.findTrustedDevice(value, EMAIL, T - 61)).toBeNull();
    });

    it.each([
      ["undefined", undefined],
      ["an empty string", ""],
      ["garbage", "garbage"],
      ["too few parts", "abc.123"],
      ["empty entries", "~~~"],
      ["a non-numeric iat", `${"n".repeat(22)}.xyz.${"s".repeat(43)}`],
      ["a negative iat", `${"n".repeat(22)}.-5.${"s".repeat(43)}`],
    ])("a malformed value (%s)", async (_name, value) => {
      const m = await load();

      expect(m.findTrustedDevice(value, EMAIL, T)).toBeNull();
    });

    it.each([
      ["a leading plus sign", (iat: number) => `+${iat}`],
      ["an exponent suffix", (iat: number) => `${iat}e0`],
    ])("a validly signed entry whose iat is rewritten with %s", async (_name, rewrite) => {
      const m = await load();
      const valid = m.issueDeviceCookie(undefined, EMAIL, T);
      const { nonce, iat, sig } = parts(valid);
      expect(m.findTrustedDevice(valid, EMAIL, T)).not.toBeNull();
      // Number() reads the rewrite as the same value, so only the format check refuses it.
      expect(Number(rewrite(iat))).toBe(iat);

      expect(m.findTrustedDevice(`${nonce}.${rewrite(iat)}.${sig}`, EMAIL, T)).toBeNull();
    });

    it("an oversized value, even when its first entry is valid", async () => {
      const m = await load();
      const valid = m.issueDeviceCookie(undefined, EMAIL, T);
      expect(m.findTrustedDevice(valid, EMAIL, T)).not.toBeNull();

      const oversized = `${valid}~${"x".repeat(2100)}`;

      expect(oversized.length).toBeGreaterThan(2048);
      expect(m.findTrustedDevice(oversized, EMAIL, T)).toBeNull();
    });

    it("a valid entry beyond the 10th position (only 10 entries are parsed)", async () => {
      const m = await load();
      const others = Array.from({ length: 10 }, () =>
        m.issueDeviceCookie(undefined, "other@example.com", T),
      );
      const mine = m.issueDeviceCookie(undefined, EMAIL, T);

      const eleventh = [...others, mine].join("~");
      const tenth = [...others.slice(0, 9), mine].join("~");

      expect(m.findTrustedDevice(eleventh, EMAIL, T)).toBeNull();
      expect(m.findTrustedDevice(tenth, EMAIL, T)).not.toBeNull();
    });
  });
});
