import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTablePagination } from "@/hooks/use-table-pagination";

// Mock dependencies
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1" } },
    status: "authenticated",
  }),
}));

vi.mock("@/lib/utils/storage", () => ({
  safeGetItem: vi.fn(() => null),
  safeSetItem: vi.fn(),
}));

vi.mock("@/lib/utils/storage-sync", () => ({
  subscribeToStorage: vi.fn(() => () => {}),
  getServerSnapshot: vi.fn(() => null),
  dispatchStorageEvent: vi.fn(),
  DEFAULT_PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
}));

describe("useTablePagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultOptions = {
    storageKeyPrefix: "test",
  };

  // ============================================================
  // Basic functionality
  // ============================================================
  describe("basic functionality", () => {
    it("should initialize with default values", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemsPerPage).toBe(10);
      expect(result.current.totalPages).toBe(3);
      expect(result.current.paginatedItems).toHaveLength(10);
    });

    it("should use custom default per page", () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, { ...defaultOptions, defaultPerPage: 20 })
      );

      expect(result.current.itemsPerPage).toBe(20);
      expect(result.current.totalPages).toBe(3);
    });

    it("should return correct paginated items", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      // First page should have items 0-9
      expect(result.current.paginatedItems[0].id).toBe(0);
      expect(result.current.paginatedItems[9].id).toBe(9);
    });
  });

  // ============================================================
  // Page navigation
  // ============================================================
  describe("page navigation", () => {
    it("should change page correctly", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      act(() => {
        result.current.setCurrentPage(2);
      });

      expect(result.current.currentPage).toBe(2);
      expect(result.current.paginatedItems[0].id).toBe(10);
    });

    it("should clamp page to valid range (min)", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      act(() => {
        result.current.setCurrentPage(0);
      });

      expect(result.current.currentPage).toBe(1);
    });

    it("should clamp page to valid range (max)", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      act(() => {
        result.current.setCurrentPage(10);
      });

      expect(result.current.currentPage).toBe(3);
    });
  });

  // ============================================================
  // Start and end indices
  // ============================================================
  describe("indices calculation", () => {
    it("should calculate correct start and end indices for page 1", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(10);
    });

    it("should calculate correct indices for page 2", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      act(() => {
        result.current.setCurrentPage(2);
      });

      expect(result.current.startIndex).toBe(10);
      expect(result.current.endIndex).toBe(20);
    });

    it("should handle last page with fewer items", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      act(() => {
        result.current.setCurrentPage(3);
      });

      expect(result.current.startIndex).toBe(20);
      expect(result.current.endIndex).toBe(30); // endIndex can exceed length
      expect(result.current.paginatedItems).toHaveLength(5);
    });
  });

  // ============================================================
  // Edge cases
  // ============================================================
  describe("edge cases", () => {
    it("should handle empty items array", () => {
      const { result } = renderHook(() =>
        useTablePagination([], defaultOptions)
      );

      expect(result.current.currentPage).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.paginatedItems).toHaveLength(0);
    });

    it("should handle items less than per page", () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      expect(result.current.totalPages).toBe(1);
      expect(result.current.paginatedItems).toHaveLength(5);
    });

    it("should adjust page when items are reduced", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result, rerender } = renderHook(
        ({ items }) => useTablePagination(items, defaultOptions),
        { initialProps: { items } }
      );

      // Go to last page
      act(() => {
        result.current.setCurrentPage(3);
      });
      expect(result.current.currentPage).toBe(3);

      // Reduce items to only 1 page
      const fewerItems = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      rerender({ items: fewerItems });

      // Page should be clamped to valid range
      expect(result.current.currentPage).toBe(1);
    });
  });

  // ============================================================
  // Page size options
  // ============================================================
  describe("page size options", () => {
    it("should return default page size options", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      expect(result.current.pageSizeOptions).toEqual([10, 20, 50, 100]);
    });

    it("should use custom page size options", () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, {
          ...defaultOptions,
          pageSizeOptions: [5, 15, 30],
        })
      );

      expect(result.current.pageSizeOptions).toEqual([5, 15, 30]);
    });
  });

  // ============================================================
  // Items per page change
  // ============================================================
  describe("items per page change", () => {
    it("should reset to page 1 when changing items per page", () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));

      const { result } = renderHook(() =>
        useTablePagination(items, defaultOptions)
      );

      // Go to page 3
      act(() => {
        result.current.setCurrentPage(3);
      });
      expect(result.current.currentPage).toBe(3);

      // Change items per page - should reset to page 1
      act(() => {
        result.current.setItemsPerPage(20);
      });

      // Note: Due to mocking, itemsPerPage won't actually change in the hook
      // but setItemsPerPage should trigger the reset
      expect(result.current.currentPage).toBe(1);
    });
  });
});
