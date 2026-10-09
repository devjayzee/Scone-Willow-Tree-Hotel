import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StaffTable } from "@/components/staff/staff-table";
import type { Staff } from "@/types/staff";

// jsdom lacks these; Radix DropdownMenu touches them when opening.
beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: "s-1",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    role: "STAFF",
    isActive: true,
    setupPending: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    _count: { bookings: 0 },
    ...overrides,
  };
}

const handlers = {
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onToggleActive: vi.fn(),
  onResendInvite: vi.fn(),
};

function renderTable(staff: Staff, currentUserId = "someone-else") {
  render(
    <StaffTable staffs={[staff]} currentUserId={currentUserId} {...handlers} />
  );
}

// The table renders a mobile card and a desktop row, so each menu exists twice;
// opening the first is enough.
function openMenu(staff: Staff) {
  const [trigger] = screen.getAllByRole("button", {
    name: `Actions for ${staff.firstName} ${staff.lastName}`,
  });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.findByRole("menu");
}

describe("StaffTable status and row actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pending row: shows Pending and Resend invite, no Activate or Deactivate", async () => {
    const staff = makeStaff({ isActive: false, setupPending: true });
    renderTable(staff);

    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();

    const menu = await openMenu(staff);
    expect(
      within(menu).getByRole("menuitem", { name: /resend invite/i })
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /^activate$/i })
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /deactivate/i })
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });

  it("deactivated row: shows Inactive and Activate, never Resend invite", async () => {
    const staff = makeStaff({ isActive: false, setupPending: false });
    renderTable(staff);

    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();

    const menu = await openMenu(staff);
    expect(
      within(menu).getByRole("menuitem", { name: /^activate$/i })
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /resend invite/i })
    ).not.toBeInTheDocument();
  });

  it("active row: shows Active and Deactivate, no Resend invite", async () => {
    const staff = makeStaff({ isActive: true, setupPending: false });
    renderTable(staff);

    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);

    const menu = await openMenu(staff);
    expect(
      within(menu).getByRole("menuitem", { name: /deactivate/i })
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /resend invite/i })
    ).not.toBeInTheDocument();
  });

  it("current user's own row: no toggle and no Delete", async () => {
    const staff = makeStaff({ id: "me", isActive: true });
    renderTable(staff, "me");

    const menu = await openMenu(staff);
    expect(
      within(menu).getByRole("menuitem", { name: /edit/i })
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /activate|deactivate/i })
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /delete/i })
    ).not.toBeInTheDocument();
  });
});
