import { vi } from "vitest";

// bcrypt mock
export const mockHash = vi.fn();

// Prisma user mocks
export const mockUserFindMany = vi.fn();
export const mockUserFindUnique = vi.fn();
export const mockUserCreate = vi.fn();
export const mockUserUpdate = vi.fn();
export const mockUserDelete = vi.fn();

// password-reset-service mock (createStaff / resendInvite call this)
export const mockIssueSetupTokenForUser = vi.fn();

// Setup mocks — call this at the top of each test file, before importing services.
export function setupMocks() {
  vi.mock("bcryptjs", () => ({
    default: {
      hash: (...args: unknown[]) => mockHash(...args),
    },
  }));

  vi.mock("@/lib/prisma", () => ({
    default: {
      user: {
        findMany: (...args: unknown[]) => mockUserFindMany(...args),
        findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        create: (...args: unknown[]) => mockUserCreate(...args),
        update: (...args: unknown[]) => mockUserUpdate(...args),
        delete: (...args: unknown[]) => mockUserDelete(...args),
      },
    },
  }));

  vi.mock("@/lib/services/audit-service", () => ({
    createAuditLog: vi.fn(),
    AuditAction: {
      STAFF_CREATED: "STAFF_CREATED",
      STAFF_UPDATED: "STAFF_UPDATED",
      STAFF_DELETED: "STAFF_DELETED",
      STAFF_DEACTIVATED: "STAFF_DEACTIVATED",
      STAFF_ACTIVATED: "STAFF_ACTIVATED",
      STAFF_INVITE_RESENT: "STAFF_INVITE_RESENT",
      STAFF_ROLE_CHANGED: "STAFF_ROLE_CHANGED",
    },
    EntityType: {
      STAFF: "STAFF",
    },
    sanitizeForAudit: <T extends Record<string, unknown>>(data: T) => {
      const sanitized = { ...data };
      delete sanitized.password;
      return sanitized;
    },
    getChangedFields: <T extends Record<string, unknown>>(
      previous: T,
      current: Partial<T>,
      ignoreFields: string[] = ["updatedAt", "password"]
    ) => {
      const changedFields: string[] = [];
      for (const key of Object.keys(current)) {
        if (ignoreFields.includes(key)) continue;
        if (current[key] !== undefined && current[key] !== previous[key]) {
          changedFields.push(key);
        }
      }
      return changedFields;
    },
  }));

  vi.mock("@/lib/services/password-reset-service", () => ({
    issueSetupTokenForUser: (...args: unknown[]) =>
      mockIssueSetupTokenForUser(...args),
  }));
}

export function createMockStaff(
  overrides: Partial<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: "GENERAL_MANAGER" | "MANAGER" | "STAFF";
    isActive: boolean;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { bookings: number };
  }> = {}
) {
  return {
    id: overrides.id ?? "staff-1",
    firstName: overrides.firstName ?? "John",
    lastName: overrides.lastName ?? "Doe",
    email: overrides.email ?? "john.doe@sconewillowtree.com",
    password: overrides.password ?? "hashedpassword",
    role: overrides.role ?? "STAFF",
    isActive: overrides.isActive ?? true,
    tokenVersion: overrides.tokenVersion ?? 0,
    createdAt: overrides.createdAt ?? new Date("2024-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2024-01-01"),
    _count: overrides._count ?? { bookings: 0 },
  };
}

export function resetMocks() {
  mockHash.mockReset();
  mockUserFindMany.mockReset();
  mockUserFindUnique.mockReset();
  mockUserCreate.mockReset();
  mockUserUpdate.mockReset();
  mockUserDelete.mockReset();
  mockIssueSetupTokenForUser.mockReset();
  // Restore default behaviors tests expect
  mockHash.mockResolvedValue("hashed_password");
  mockIssueSetupTokenForUser.mockResolvedValue("stub-setup-token");
}
