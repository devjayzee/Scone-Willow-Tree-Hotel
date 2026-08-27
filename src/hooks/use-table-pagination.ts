import { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { safeGetItem, safeSetItem } from "@/lib/utils/storage";
import {
  subscribeToStorage,
  getServerSnapshot,
  dispatchStorageEvent,
  DEFAULT_PAGE_SIZE_OPTIONS,
} from "@/lib/utils/storage-sync";

interface UseTablePaginationOptions {
  /** Storage key prefix for persisting items per page preference */
  storageKeyPrefix: string;
  /** Default items per page */
  defaultPerPage?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
}

interface UseTablePaginationResult<T> {
  /** Current page (1-indexed) */
  currentPage: number;
  /** Set current page */
  setCurrentPage: (page: number) => void;
  /** Items per page */
  itemsPerPage: number;
  /** Set items per page (also resets to page 1 and persists to localStorage) */
  setItemsPerPage: (value: number) => void;
  /** Total number of pages */
  totalPages: number;
  /** Paginated items for current page */
  paginatedItems: T[];
  /** Start index (0-based) */
  startIndex: number;
  /** End index (exclusive) */
  endIndex: number;
  /** Available page size options */
  pageSizeOptions: readonly number[];
}

export function useTablePagination<T>(
  items: T[],
  options: UseTablePaginationOptions
): UseTablePaginationResult<T> {
  const {
    storageKeyPrefix,
    defaultPerPage = DEFAULT_PAGE_SIZE_OPTIONS[0],
    pageSizeOptions = [...DEFAULT_PAGE_SIZE_OPTIONS],
  } = options;

  const { data: session } = useSession();
  const [currentPage, setCurrentPageState] = useState(1);

  const storageKey = `${storageKeyPrefix}-per-page-${session?.user?.id || "default"}`;

  // Use useSyncExternalStore to read from localStorage (React 18+ recommended pattern)
  const storedValue = useSyncExternalStore(
    subscribeToStorage,
    () => safeGetItem(storageKey),
    getServerSnapshot
  );

  // Derive itemsPerPage from stored value
  const itemsPerPage = useMemo(() => {
    if (storedValue) {
      const parsed = parseInt(storedValue, 10);
      if (pageSizeOptions.includes(parsed)) {
        return parsed;
      }
    }
    return defaultPerPage;
  }, [storedValue, pageSizeOptions, defaultPerPage]);

  // Calculate total pages
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / itemsPerPage)),
    [items.length, itemsPerPage]
  );

  // Compute effective current page (clamped to valid range)
  const effectiveCurrentPage = useMemo(() => {
    if (currentPage > totalPages) {
      return totalPages;
    }
    return currentPage;
  }, [currentPage, totalPages]);

  // Setter that clamps page to valid range
  const setCurrentPage = useCallback((page: number) => {
    const clampedPage = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPageState(clampedPage);
  }, [totalPages]);

  // Calculate pagination values using effective page
  const startIndex = (effectiveCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  // Handler for changing items per page
  const setItemsPerPage = useCallback(
    (value: number) => {
      safeSetItem(storageKey, value.toString());
      setCurrentPageState(1);
      // Dispatch storage event to notify useSyncExternalStore
      dispatchStorageEvent(storageKey);
    },
    [storageKey]
  );

  return {
    currentPage: effectiveCurrentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginatedItems,
    startIndex,
    endIndex,
    pageSizeOptions,
  };
}
