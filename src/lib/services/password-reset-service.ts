import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, PasswordResetTokenPurpose } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BCRYPT_COST } from "@/lib/constants/auth";
import { NotFoundError } from "@/lib/errors";
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
