/**
 * Utilities for synchronizing React state with localStorage using useSyncExternalStore
 * These are the recommended React 18+ patterns for external store synchronization
 */

/**
 * Subscribe to storage events for useSyncExternalStore
 * This allows React to re-render when localStorage changes
 */
export function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Server snapshot for SSR - returns null since localStorage doesn't exist on server
 */
export function getServerSnapshot(): null {
  return null;
}

/**
 * Dispatch a storage event to notify useSyncExternalStore subscribers
 * Call this after updating localStorage to trigger React re-renders
 */
export function dispatchStorageEvent(key: string): void {
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/**
 * Default page size options for table pagination
 */
export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];

export type PageSizeOption = 10 | 20 | 50;
