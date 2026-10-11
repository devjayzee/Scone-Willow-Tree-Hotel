import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StaffDialog } from "@/components/staff/staff-dialog";
import type { Staff } from "@/types/staff";

// jsdom lacks these; Radix Dialog and Select touch them.
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

const WARNING =
  "Changing the email resets access. Alice will be signed out and their password will stop working. After saving, use Resend invite to send a setup link.";

function renderDialog(
  staff: Staff | null,
  props: { currentUserId?: string } = { currentUserId: "someone-else" }
) {
  render(
    <StaffDialog
      open
      onOpenChange={vi.fn()}
      staff={staff}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />
  );
}

const emailInput = () => screen.getByRole("textbox", { name: /email/i });
const changeEmail = (value: string) =>
  fireEvent.change(emailInput(), { target: { value } });

// The status region is always rendered; "no warning" means it holds no text.
const expectNoWarning = () => {
  const text = screen.queryByRole("status")?.textContent ?? "";
  expect(text).not.toContain("resets access");
};

describe("StaffDialog access-reset warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("L1: the live region exists and is empty in edit mode before the email changes", () => {
    renderDialog(makeStaff());

    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    expect(emailInput().getAttribute("aria-describedby") ?? "").not.toContain(
      region.id
    );
  });

  it("L1: the live region exists and is empty in create mode", () => {
    renderDialog(null);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("L1: the same region node fills when the email changes and empties when it is changed back", () => {
    renderDialog(makeStaff());
    const region = screen.getByRole("status");

    changeEmail("right.person@example.com");

    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent(WARNING);
    expect(emailInput().getAttribute("aria-describedby") ?? "").toContain(
      region.id
    );

    changeEmail("alice@example.com");

    expect(region).toBeEmptyDOMElement();
    expect(emailInput().getAttribute("aria-describedby") ?? "").not.toContain(
      region.id
    );
  });

  it("F1: warns, relabels the button and links the warning to the email field when a set-up account's email changes", () => {
    renderDialog(makeStaff());
    expectNoWarning();
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();

    changeEmail("right.person@example.com");

    const warning = screen.getByRole("status");
    expect(warning).toHaveTextContent(WARNING);
    expect(warning.id).not.toBe("");
    expect(emailInput().getAttribute("aria-describedby") ?? "").toContain(
      warning.id
    );
    expect(
      screen.getByRole("button", { name: "Save and reset access" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save Changes" })
    ).not.toBeInTheDocument();
  });

  it("F1: the warning applies to a deactivated set-up account too", () => {
    renderDialog(makeStaff({ isActive: false }));

    changeEmail("right.person@example.com");

    expect(screen.getByRole("status")).toHaveTextContent(WARNING);
  });

  it("F1: uses the saved first name, not the name being typed", () => {
    renderDialog(makeStaff());

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Zed" },
    });
    changeEmail("right.person@example.com");

    expect(screen.getByRole("status")).toHaveTextContent(WARNING);
  });

  it("F4: the warning, the description link and the button label go away when the email is changed back", () => {
    renderDialog(makeStaff());
    changeEmail("right.person@example.com");
    expect(screen.getByRole("status")).toBeInTheDocument();
    const id = screen.getByRole("status").id;

    changeEmail("alice@example.com");

    expectNoWarning();
    expect(emailInput().getAttribute("aria-describedby") ?? "").not.toContain(
      id
    );
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();
  });

  it("F2 (guard): a case-only or whitespace-only edit shows no warning", () => {
    renderDialog(makeStaff());

    changeEmail("  ALICE@Example.com ");

    expectNoWarning();
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();
  });

  it("F3 (guard): a pending account shows no warning", () => {
    renderDialog(makeStaff({ isActive: false, setupPending: true }));

    changeEmail("right.person@example.com");

    expectNoWarning();
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();
  });

  it("F3 (guard): the caller's own account shows no warning", () => {
    renderDialog(makeStaff({ id: "me" }), { currentUserId: "me" });

    changeEmail("right.person@example.com");

    expectNoWarning();
    expect(
      screen.getByRole("button", { name: "Save Changes" })
    ).toBeInTheDocument();
  });

  it("F1: without a currentUserId the warning still shows for a set-up account (prop is optional)", () => {
    renderDialog(makeStaff(), {});

    changeEmail("right.person@example.com");

    expect(screen.getByRole("status")).toHaveTextContent(WARNING);
  });

  it("F3 (guard): create mode shows no warning and keeps the Add Staff label", () => {
    renderDialog(null);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Jones" },
    });
    changeEmail("bob.other@example.com");

    expectNoWarning();
    expect(
      screen.getByRole("button", { name: "Add Staff" })
    ).toBeInTheDocument();
  });
});
