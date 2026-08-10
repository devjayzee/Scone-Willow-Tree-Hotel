import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, PasswordResetTokenPurpose } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BCRYPT_COST } from "@/lib/constants/auth";
import { NotFoundError, RateLimitError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getForgotPasswordRateLimiter } from "@/lib/services/rate-limit-service";
import { getEmailTransport } from "@/lib/email/email-transport";
import { passwordResetEmail } from "@/lib/email/templates/password-reset";
import {
  createAuditLog,
  AuditAction,
  EntityType,
} from "@/lib/services/audit-service";

export const RESET_TOKEN_TTL_MINUTES = 30;
export const SETUP_TOKEN_TTL_HOURS = 72;

const INVALID_TOKEN_MESSAGE = "This link is invalid or has expired";

/**
 * SHA-256 hex of a raw token. Raw tokens only ever travel in emails/URLs;
 * the database stores this hash.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Issuing a fresh token voids any prior unused tokens of the same purpose,
 * so a leaked older link dies the moment a new one is requested.
 */
async function voidActiveTokens(
  userId: string,
  purpose: PasswordResetTokenPurpose
): Promise<void> {
  await prisma.passwordResetToken.updateMany({
    where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
}

/**
 * Never throws for an unknown email — the forgot-password route must not
 * be able to leak account existence. Returns nulls instead.
 */
export async function issueResetTokenForEmail(email: string): Promise<{
  emailedToken: string | null;
  user: { id: string; email: string; firstName: string } | null;
}> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return { emailedToken: null, user: null };
  }

  await voidActiveTokens(user.id, "RESET");

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId: user.id,
      purpose: "RESET",
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
    },
  });

  return {
    emailedToken: rawToken,
    user: { id: user.id, email: user.email, firstName: user.firstName },
  };
}

export async function issueSetupTokenForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new NotFoundError("User not found");
  }

  await voidActiveTokens(userId, "SETUP");

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId,
      purpose: "SETUP",
      expiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_HOURS * 3_600_000),
    },
  });

  return rawToken;
}

async function findValidToken(
  rawToken: string,
  purpose: PasswordResetTokenPurpose
) {
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, role: true },
      },
    },
  });
  // One error for missing/wrong-purpose/used/expired — callers must not be
  // able to probe which failure occurred.
  if (
    !token ||
    token.purpose !== purpose ||
    token.usedAt !== null ||
    token.expiresAt <= new Date()
  ) {
    throw new NotFoundError(INVALID_TOKEN_MESSAGE);
  }
  return token;
}

export interface ResolvedInvite {
  email: string;
  firstName: string;
  role: Role;
}

export async function resolveSetupInvite(
  rawToken: string
): Promise<ResolvedInvite> {
  const token = await findValidToken(rawToken, "SETUP");
  return {
    email: token.user.email,
    firstName: token.user.firstName,
    role: token.user.role,
  };
}

async function consumeToken(
  rawToken: string,
  newPassword: string,
  purpose: PasswordResetTokenPurpose
): Promise<{ userId: string }> {
  const token = await findValidToken(rawToken, purpose);
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);

  await prisma.$transaction(async (tx) => {
    // Claim the token first: the conditional updateMany + count check is
    // the atomic single-use guard. If a concurrent request already
    // consumed it during the bcrypt window above, count === 0 and this
    // throw aborts the transaction (no password write, no audit).
    const claim = await tx.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new NotFoundError(INVALID_TOKEN_MESSAGE);
    }
    await tx.user.update({
      where: { id: token.userId },
      data: {
        password: hashedPassword,
        // Invalidate every live session for this user
        tokenVersion: { increment: 1 },
        ...(purpose === "SETUP" && { isActive: true }),
      },
    });
  });

  await createAuditLog(
    token.userId,
    purpose === "RESET"
      ? AuditAction.STAFF_PASSWORD_RESET
      : AuditAction.STAFF_PASSWORD_SETUP,
    EntityType.STAFF,
    token.userId,
    { reason: `Password ${purpose === "RESET" ? "reset" : "setup"} via emailed token` }
  );

  return { userId: token.userId };
}

export async function consumeResetToken(input: {
  rawToken: string;
  newPassword: string;
}): Promise<{ userId: string }> {
  return consumeToken(input.rawToken, input.newPassword, "RESET");
}

export async function consumeSetupToken(input: {
  rawToken: string;
  newPassword: string;
}): Promise<{ userId: string }> {
  return consumeToken(input.rawToken, input.newPassword, "SETUP");
}

/**
 * Callback shape used by `requestPasswordReset` to schedule the email
 * send after the HTTP response returns. The route passes Next.js's
 * `after` from `next/server`; tests pass a spy. Keeping the runtime
 * primitive out of the service preserves Rule 2 (services don't touch
 * HTTP infrastructure).
 */
export type DeferSend = (task: () => Promise<void>) => void;

/**
 * Orchestrates the full forgot-password flow — rate limiting, token
 * issuance, deferred mailer dispatch — so the route stays a thin
 * parse/serialize wrapper (Rule 1, #146). Deferring the send is the
 * timing-enumeration protection from #139: known and unknown emails
 * take comparable time because the Resend HTTP call runs post-response.
 *
 * @throws RateLimitError when either the `ip:` or `email:` bucket is
 *   over quota. handleApiError maps to 429.
 */
export async function requestPasswordReset(
  { email, ip }: { email: string; ip: string },
  deferSend: DeferSend,
): Promise<void> {
  const limiter = getForgotPasswordRateLimiter();
  if (limiter) {
    const [byIp, byEmail] = await Promise.all([
      limiter.limit(`ip:${ip}`),
      limiter.limit(`email:${email}`),
    ]);
    if (!byIp.success || !byEmail.success) {
      throw new RateLimitError("Too many reset requests. Try again later.");
    }
  }

  const { emailedToken, user } = await issueResetTokenForEmail(email);
  if (!emailedToken || !user) return;

  const { subject, text, html } = passwordResetEmail({
    firstName: user.firstName,
    rawToken: emailedToken,
  });
  const to = user.email;
  const userId = user.id;
  deferSend(async () => {
    try {
      await getEmailTransport().send({ to, subject, text, html });
    } catch (mailError) {
      // Swallow — surfacing a mailer failure would leak account
      // existence, defeating the enumeration protection.
      logger.error("Failed to send password-reset email", mailError, {
        userId,
      });
    }
  });
}
