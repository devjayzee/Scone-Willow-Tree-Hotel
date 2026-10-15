import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseSession = vi.fn();
const mockSignOut = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// jsdom's window.location can't be stubbed, so the shell goes through this
// module for hard navigations.
const mockHardReplace = vi.fn();
const mockHardReload = vi.fn();
vi.mock("@/lib/utils/hard-navigation", () => ({
  hardReplace: (...args: unknown[]) => mockHardReplace(...args),
  hardReload: (...args: unknown[]) => mockHardReload(...args),
}));

// Stubs keep the test on the shell's session handling, not its children.
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/layout/header", () => ({ Header: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));

import { DashboardShell } from "@/components/layout/dashboard-shell";

const LOADING = { data: null, status: "loading" };
const UNAUTHENTICATED = { data: null, status: "unauthenticated" };
const NO_USER = { data: { expires: "x" }, status: "authenticated" };
const SIGNED_IN = {
  data: { user: { id: "u-1" }, expires: "x" },
  status: "authenticated",
};

function renderShell(initial: object) {
  mockUseSession.mockReturnValue(initial);
  const view = render(
    <DashboardShell>
      <p>page body</p>
    </DashboardShell>,
  );
  return {
    ...view,
    setSession(next: object) {
      mockUseSession.mockReturnValue(next);
      view.rerender(
        <DashboardShell>
          <p>page body</p>
        </DashboardShell>,
      );
    },
  };
}

describe("DashboardShell session handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // The shell never signs out by itself, in any case.
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("hard-replaces to /login when authenticated but the session has no user", () => {
    renderShell(NO_USER);

    expect(mockHardReplace).toHaveBeenCalledTimes(1);
    expect(mockHardReplace).toHaveBeenCalledWith("/login");
    expect(mockHardReload).not.toHaveBeenCalled();
  });

  it("hard-reloads once when a signed-in session turns unauthenticated", () => {
    // next-auth reports "unauthenticated" for any failed poll (429, 502, 504),
    // so the cookie may be live: reload and let the server decide.
    const shell = renderShell(SIGNED_IN);
    shell.setSession(UNAUTHENTICATED);

    expect(mockHardReload).toHaveBeenCalledTimes(1);
    expect(mockHardReplace).not.toHaveBeenCalled();
  });

  it("does nothing when it mounts already unauthenticated", () => {
    // A soft navigation into the dashboard after a failed session fetch: the
    // shell never saw a signed-in session, so reloading would loop.
    renderShell(UNAUTHENTICATED);

    expect(mockHardReload).not.toHaveBeenCalled();
    expect(mockHardReplace).not.toHaveBeenCalled();
  });

  it("does nothing when a first fetch fails (loading then unauthenticated)", () => {
    const shell = renderShell(LOADING);
    shell.setSession(UNAUTHENTICATED);

    expect(mockHardReload).not.toHaveBeenCalled();
    expect(mockHardReplace).not.toHaveBeenCalled();
  });

  it("does nothing when authenticated with a user", () => {
    renderShell(SIGNED_IN);

    expect(screen.getByText("page body")).toBeInTheDocument();
    expect(mockHardReload).not.toHaveBeenCalled();
    expect(mockHardReplace).not.toHaveBeenCalled();
  });

  it("does nothing while loading", () => {
    renderShell(LOADING);

    expect(mockHardReload).not.toHaveBeenCalled();
    expect(mockHardReplace).not.toHaveBeenCalled();
  });
});
