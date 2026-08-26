import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuditLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { logStaffUpdateAudits } from "@/lib/services/staff/staff-audit";

describe("logStaffUpdateAudits", () => {
  const existingStaff = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    role: "STAFF",
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when performedBy is omitted", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      existingStaff,
      { role: "MANAGER" },
      undefined,
    );

    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("logs STAFF_ROLE_CHANGED when role changes", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      existingStaff,
      { role: "MANAGER" },
      "manager-1",
    );

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "manager-1",
        action: "STAFF_ROLE_CHANGED",
        entityType: "STAFF",
        entityId: "staff-1",
        details: {
          previous: { role: "STAFF" },
          current: { role: "MANAGER" },
        },
      },
    });
  });

  it("logs STAFF_ACTIVATED when isActive flips false to true", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      { ...existingStaff, isActive: false },
      { isActive: true },
      "manager-1",
    );

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "manager-1",
        action: "STAFF_ACTIVATED",
        entityType: "STAFF",
        entityId: "staff-1",
        details: {
          previous: { isActive: false },
          current: { isActive: true },
        },
      },
    });
  });

  it("logs STAFF_DEACTIVATED when isActive flips true to false", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      existingStaff,
      { isActive: false },
      "manager-1",
    );

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "manager-1",
        action: "STAFF_DEACTIVATED",
        entityType: "STAFF",
        entityId: "staff-1",
        details: {
          previous: { isActive: true },
          current: { isActive: false },
        },
      },
    });
  });

  it("logs both STAFF_ROLE_CHANGED and STAFF_ACTIVATED when both change together", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      { ...existingStaff, isActive: false },
      { role: "GENERAL_MANAGER", isActive: true },
      "manager-1",
    );

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(2);
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "STAFF_ROLE_CHANGED" }),
      }),
    );
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "STAFF_ACTIVATED" }),
      }),
    );
    // Role/active-status changes are logged on their own dedicated
    // actions — no redundant generic STAFF_UPDATED entry alongside them.
    expect(mockAuditLogCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "STAFF_UPDATED" }),
      }),
    );
  });

  it("logs STAFF_UPDATED for a generic field change when role/active are untouched", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      existingStaff,
      { firstName: "Janet" },
      "manager-1",
    );

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "manager-1",
        action: "STAFF_UPDATED",
        entityType: "STAFF",
        entityId: "staff-1",
        details: {
          previous: { firstName: "Jane" },
          current: { firstName: "Janet" },
          changedFields: ["firstName"],
        },
      },
    });
  });

  it("does not log STAFF_UPDATED when no fields actually changed", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      existingStaff,
      { firstName: "Jane" },
      "manager-1",
    );

    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("does not log STAFF_UPDATED when the only change is role (already covered by STAFF_ROLE_CHANGED)", async () => {
    await logStaffUpdateAudits(
      "staff-1",
      existingStaff,
      { role: "MANAGER" },
      "manager-1",
    );

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "STAFF_ROLE_CHANGED" }),
      }),
    );
  });
});
