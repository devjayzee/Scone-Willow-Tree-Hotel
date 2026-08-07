import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
const mockAuditLogCreate = vi.fn();
const mockAuditLogFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
    },
  },
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import {
  createAuditLog,
  getAuditLogsForEntity,
  getAuditLogsByUser,
  getRecentAuditLogs,
  sanitizeForAudit,
  getChangedFields,
  AuditAction,
  EntityType,
} from "@/lib/services/audit-service";

describe("Audit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // AuditAction constants
  // ============================================================
  describe("AuditAction", () => {
    it("should have staff actions", () => {
      expect(AuditAction.STAFF_CREATED).toBe("STAFF_CREATED");
      expect(AuditAction.STAFF_UPDATED).toBe("STAFF_UPDATED");
      expect(AuditAction.STAFF_DELETED).toBe("STAFF_DELETED");
      expect(AuditAction.STAFF_DEACTIVATED).toBe("STAFF_DEACTIVATED");
      expect(AuditAction.STAFF_ACTIVATED).toBe("STAFF_ACTIVATED");
      expect(AuditAction.STAFF_PASSWORD_CHANGED).toBe("STAFF_PASSWORD_CHANGED");
      expect(AuditAction.STAFF_ROLE_CHANGED).toBe("STAFF_ROLE_CHANGED");
    });

    it("should have room actions", () => {
      expect(AuditAction.ROOM_CREATED).toBe("ROOM_CREATED");
      expect(AuditAction.ROOM_UPDATED).toBe("ROOM_UPDATED");
      expect(AuditAction.ROOM_DELETED).toBe("ROOM_DELETED");
    });

    it("should have booking actions", () => {
      expect(AuditAction.BOOKING_CREATED).toBe("BOOKING_CREATED");
      expect(AuditAction.BOOKING_UPDATED).toBe("BOOKING_UPDATED");
      expect(AuditAction.BOOKING_DELETED).toBe("BOOKING_DELETED");
      expect(AuditAction.BOOKING_CANCELLED).toBe("BOOKING_CANCELLED");
      expect(AuditAction.BOOKING_CHECKED_IN).toBe("BOOKING_CHECKED_IN");
      expect(AuditAction.BOOKING_CHECKED_OUT).toBe("BOOKING_CHECKED_OUT");
    });
  });

  // ============================================================
  // EntityType constants
  // ============================================================
  describe("EntityType", () => {
    it("should have all entity types", () => {
      expect(EntityType.STAFF).toBe("STAFF");
      expect(EntityType.ROOM).toBe("ROOM");
      expect(EntityType.BOOKING).toBe("BOOKING");
    });
  });

  // ============================================================
  // createAuditLog
  // ============================================================
  describe("createAuditLog", () => {
    it("should create audit log entry", async () => {
      mockAuditLogCreate.mockResolvedValue({ id: "audit-1" });

      await createAuditLog(
        "user-1",
        AuditAction.BOOKING_CREATED,
        EntityType.BOOKING,
        "booking-1",
        { current: { guestName: "John Doe" } }
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          action: "BOOKING_CREATED",
          entityType: "BOOKING",
          entityId: "booking-1",
          details: { current: { guestName: "John Doe" } },
        },
      });
    });

    it("should create audit log without details", async () => {
      mockAuditLogCreate.mockResolvedValue({ id: "audit-1" });

      await createAuditLog(
        "user-1",
        AuditAction.STAFF_DELETED,
        EntityType.STAFF,
        "staff-1"
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          action: "STAFF_DELETED",
          entityType: "STAFF",
          entityId: "staff-1",
          details: null,
        },
      });
    });

    it("should not throw error on database failure", async () => {
      mockAuditLogCreate.mockRejectedValue(new Error("Database error"));

      // Should not throw
      await expect(
        createAuditLog("user-1", AuditAction.ROOM_CREATED, EntityType.ROOM, "room-1")
      ).resolves.toBeUndefined();
    });

    // #118 — createAuditLog reads request forensics from AsyncLocalStorage
    // set by `runWithAuditContext` at the route handler.
    it("merges ipAddress and userAgent from the ambient audit context", async () => {
      const { runWithAuditContext } = await import(
        "@/lib/services/audit-context"
      );
      mockAuditLogCreate.mockResolvedValue({ id: "audit-ctx" });

      await runWithAuditContext(
        { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 test" },
        async () => {
          await createAuditLog(
            "user-1",
            AuditAction.BOOKING_UPDATED,
            EntityType.BOOKING,
            "booking-1",
            { current: { guestName: "Jane" } },
          );
        },
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          action: "BOOKING_UPDATED",
          entityType: "BOOKING",
          entityId: "booking-1",
          details: {
            current: { guestName: "Jane" },
            ipAddress: "203.0.113.7",
            userAgent: "Mozilla/5.0 test",
          },
        },
      });
    });

    it("still works with no ambient context (writes null forensics)", async () => {
      mockAuditLogCreate.mockResolvedValue({ id: "audit-nc" });

      await createAuditLog(
        "user-1",
        AuditAction.STAFF_UPDATED,
        EntityType.STAFF,
        "staff-1",
      );

      const call = mockAuditLogCreate.mock.calls[0][0];
      expect(call.data.details).toBeNull();
    });

    it("attaches only the fields the context actually has (undefined UA)", async () => {
      const { runWithAuditContext } = await import(
        "@/lib/services/audit-context"
      );
      mockAuditLogCreate.mockResolvedValue({ id: "audit-partial" });

      await runWithAuditContext(
        { ipAddress: "198.51.100.1" },
        async () => {
          await createAuditLog(
            "user-1",
            AuditAction.STAFF_ACTIVATED,
            EntityType.STAFF,
            "staff-1",
          );
        },
      );

      const call = mockAuditLogCreate.mock.calls[0][0];
      expect(call.data.details).toEqual({ ipAddress: "198.51.100.1" });
      expect(call.data.details).not.toHaveProperty("userAgent");
    });
  });

  // ============================================================
  // getAuditLogsForEntity
  // ============================================================
  describe("getAuditLogsForEntity", () => {
    it("should fetch audit logs for entity", async () => {
      const mockLogs = [
        { id: "log-1", action: "BOOKING_CREATED" },
        { id: "log-2", action: "BOOKING_UPDATED" },
      ];
      mockAuditLogFindMany.mockResolvedValue(mockLogs);

      const result = await getAuditLogsForEntity(EntityType.BOOKING, "booking-1");

      expect(mockAuditLogFindMany).toHaveBeenCalledWith({
        where: {
          entityType: "BOOKING",
          entityId: "booking-1",
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      expect(result).toEqual(mockLogs);
    });

    it("should respect custom limit", async () => {
      mockAuditLogFindMany.mockResolvedValue([]);

      await getAuditLogsForEntity(EntityType.STAFF, "staff-1", 10);

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  // ============================================================
  // getAuditLogsByUser
  // ============================================================
  describe("getAuditLogsByUser", () => {
    it("should fetch audit logs for user", async () => {
      const mockLogs = [{ id: "log-1" }];
      mockAuditLogFindMany.mockResolvedValue(mockLogs);

      const result = await getAuditLogsByUser("user-1");

      expect(mockAuditLogFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      expect(result).toEqual(mockLogs);
    });

    it("should respect custom limit", async () => {
      mockAuditLogFindMany.mockResolvedValue([]);

      await getAuditLogsByUser("user-1", 25);

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 })
      );
    });
  });

  // ============================================================
  // getRecentAuditLogs
  // ============================================================
  describe("getRecentAuditLogs", () => {
    it("should fetch recent logs with default options", async () => {
      mockAuditLogFindMany.mockResolvedValue([]);

      await getRecentAuditLogs();

      expect(mockAuditLogFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        take: 100,
        skip: 0,
      });
    });

    it("should filter by entityType", async () => {
      mockAuditLogFindMany.mockResolvedValue([]);

      await getRecentAuditLogs({ entityType: EntityType.BOOKING });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: "BOOKING" },
        })
      );
    });

    it("should filter by action", async () => {
      mockAuditLogFindMany.mockResolvedValue([]);

      await getRecentAuditLogs({ action: AuditAction.STAFF_CREATED });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: "STAFF_CREATED" },
        })
      );
    });

    it("should support pagination", async () => {
      mockAuditLogFindMany.mockResolvedValue([]);

      await getRecentAuditLogs({ limit: 20, offset: 40 });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it("should combine all filters", async () => {
      mockAuditLogFindMany.mockResolvedValue([]);

      await getRecentAuditLogs({
        entityType: EntityType.ROOM,
        action: AuditAction.ROOM_UPDATED,
        limit: 10,
        offset: 5,
      });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith({
        where: {
          entityType: "ROOM",
          action: "ROOM_UPDATED",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 5,
      });
    });
  });

  // ============================================================
  // sanitizeForAudit
  // ============================================================
  describe("sanitizeForAudit", () => {
    it("should remove password field by default", () => {
      const data = {
        email: "test@example.com",
        password: "secret123",
        name: "John",
      };

      const sanitized = sanitizeForAudit(data);

      expect(sanitized.email).toBe("test@example.com");
      expect(sanitized.name).toBe("John");
      expect(sanitized).not.toHaveProperty("password");
    });

    it("should remove token field by default", () => {
      const data = {
        id: "user-1",
        token: "jwt-token-here",
      };

      const sanitized = sanitizeForAudit(data);

      expect(sanitized.id).toBe("user-1");
      expect(sanitized).not.toHaveProperty("token");
    });

    it("should remove secret field by default", () => {
      const data = {
        id: "api-1",
        secret: "api-secret",
      };

      const sanitized = sanitizeForAudit(data);

      expect(sanitized.id).toBe("api-1");
      expect(sanitized).not.toHaveProperty("secret");
    });

    it("should accept custom sensitive fields", () => {
      const data = {
        email: "test@example.com",
        ssn: "123-45-6789",
        creditCard: "1234-5678-9012-3456",
      };

      const sanitized = sanitizeForAudit(data, ["ssn", "creditCard"]);

      expect(sanitized.email).toBe("test@example.com");
      expect(sanitized).not.toHaveProperty("ssn");
      expect(sanitized).not.toHaveProperty("creditCard");
    });

    it("should not modify original object", () => {
      const data = {
        email: "test@example.com",
        password: "secret",
      };

      sanitizeForAudit(data);

      expect(data.password).toBe("secret");
    });

    it("should handle object without sensitive fields", () => {
      const data = {
        name: "John",
        email: "john@example.com",
      };

      const sanitized = sanitizeForAudit(data);

      expect(sanitized).toEqual(data);
    });
  });

  // ============================================================
  // getChangedFields
  // ============================================================
  describe("getChangedFields", () => {
    it("should detect changed fields", () => {
      const previous = { name: "John", email: "john@example.com", role: "STAFF" };
      const current = { name: "Jane", role: "MANAGER" };

      const changed = getChangedFields(previous, current);

      expect(changed).toContain("name");
      expect(changed).toContain("role");
      expect(changed).not.toContain("email");
    });

    it("should ignore updatedAt by default", () => {
      const previous = { name: "John", updatedAt: new Date("2024-01-01") };
      const current = { name: "John", updatedAt: new Date("2024-01-02") };

      const changed = getChangedFields(previous, current);

      expect(changed).not.toContain("updatedAt");
    });

    it("should ignore password by default", () => {
      const previous = { email: "test@example.com", password: "old" };
      const current = { password: "new" };

      const changed = getChangedFields(previous, current);

      expect(changed).not.toContain("password");
    });

    it("should accept custom ignore fields", () => {
      const previous = { name: "John", internalField: "old" };
      const current = { name: "Jane", internalField: "new" };

      const changed = getChangedFields(previous, current, ["internalField"]);

      expect(changed).toContain("name");
      expect(changed).not.toContain("internalField");
    });

    it("should return empty array when no changes", () => {
      const previous = { name: "John", email: "john@example.com" };
      const current = { name: "John" };

      const changed = getChangedFields(previous, current);

      expect(changed).toEqual([]);
    });

    it("should handle undefined values in current", () => {
      const previous = { name: "John", email: "john@example.com" };
      const current = { name: undefined };

      const changed = getChangedFields(previous, current);

      expect(changed).not.toContain("name");
    });

    it("should detect type changes", () => {
      const previous = { count: 5 };
      // Deliberately wrong type — the whole point of this test is to prove
      // getChangedFields catches a runtime type mismatch.
      // @ts-expect-error - intentional type mismatch for runtime detection
      const current: Partial<typeof previous> = { count: "5" };

      const changed = getChangedFields(previous, current);

      expect(changed).toContain("count");
    });
  });
});
