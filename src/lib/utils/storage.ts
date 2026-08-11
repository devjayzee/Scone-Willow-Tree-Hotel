/**
 * Safe localStorage utilities with SSR support
 * Handles cases where localStorage is unavailable (SSR, private browsing, etc.)
 */

export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage might be unavailable (private browsing, storage quota exceeded, etc.)
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // localStorage might be unavailable or quota exceeded
    return false;
  }
}

