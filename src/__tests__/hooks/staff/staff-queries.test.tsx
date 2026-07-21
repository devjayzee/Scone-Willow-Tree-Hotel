import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockFetchStaffs = vi.fn();
vi.mock("@/hooks/staff/staff-api", () => ({
  fetchStaffs: (...args: unknown[]) => mockFetchStaffs(...args),
}));

import type { Staff, Role } from "@/types/staff";
import { useStaffs } from "@/hooks/staff/staff-queries";

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: "s-1",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    role: "STAFF" as Role,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    _count: { bookings: 0 },
    ...overrides,
  };
}

describe("useStaffs", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("uses initialData without hitting the network", () => {
    const seeded = [makeStaff({ id: "seed" })];

    const { result } = renderHook(
      () => useStaffs(seeded, Date.now()),
      { wrapper }
    );

    expect(result.current.data).toEqual(seeded);
    expect(mockFetchStaffs).not.toHaveBeenCalled();
  });

  it("surfaces fetched data through result.current.data on refetch", async () => {
    const fetched = [makeStaff({ id: "fetched" })];
    mockFetchStaffs.mockResolvedValue(fetched);

    const { result } = renderHook(() => useStaffs(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(fetched);
    });
    expect(mockFetchStaffs).toHaveBeenCalledTimes(1);
  });
});
