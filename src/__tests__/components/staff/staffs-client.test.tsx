import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Staff } from "@/types/staff";

const makeMutation = () => ({ mutateAsync: vi.fn(), isPending: false });
const mockUseStaffs = vi.fn();
vi.mock("@/hooks/staff", () => ({
  useStaffs: (...args: unknown[]) => mockUseStaffs(...args),
  useCreateStaff: () => makeMutation(),
  useUpdateStaff: () => makeMutation(),
  useDeleteStaff: () => makeMutation(),
  useToggleStaffActive: () => makeMutation(),
  useResendInvite: () => makeMutation(),
}));

import { StaffsClient } from "@/components/staff/staffs-client";

// jsdom lacks these; Radix Dialog, Select and DropdownMenu touch them.
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
    id: "other",
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

const me = makeStaff({ id: "me", firstName: "Gina", lastName: "Manager" });
const other = makeStaff();

async function editRowAndChangeEmail(name: string) {
  // Each row renders a mobile card and a desktop row, so the menu exists twice.
  const [trigger] = screen.getAllByRole("button", {
    name: `Actions for ${name}`,
  });
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: /edit/i }));
  fireEvent.change(await screen.findByRole("textbox", { name: /email/i }), {
    target: { value: "right.person@example.com" },
  });
}

describe("StaffsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseStaffs.mockReturnValue({
      data: [me, other],
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it("passes currentUserId to the dialog: editing your own row shows no access-reset warning", async () => {
    render(<StaffsClient initialStaffs={[me, other]} currentUserId="me" />);

    await editRowAndChangeEmail("Gina Manager");

    expect(screen.queryByRole("status")?.textContent ?? "").not.toContain(
      "resets access"
    );
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();
  });

  it("guard: editing someone else's row shows the warning", async () => {
    render(<StaffsClient initialStaffs={[me, other]} currentUserId="me" />);

    await editRowAndChangeEmail("Alice Smith");

    expect(screen.getByRole("status")).toHaveTextContent("resets access");
    expect(
      screen.getByRole("button", { name: "Save and reset access" })
    ).toBeInTheDocument();
  });
});
