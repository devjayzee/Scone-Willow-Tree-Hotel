import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { safeGetItem, safeSetItem } from "@/lib/utils/storage";

// This jsdom/vitest/Node combination doesn't provide a working
// localStorage at all (neither bare nor window.localStorage) — Node 26
// claims the global for its own experimental webstorage, which throws
// without --localstorage-file, and jsdom declines to polyfill over it.
// storage.ts references the bare `localStorage` identifier, so stub a
// minimal in-memory implementation on globalThis for these tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

describe("storage", () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    vi.stubGlobal("localStorage", memoryStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("safeGetItem", () => {
    it("returns the stored value", () => {
      memoryStorage.setItem("k", "v");
      expect(safeGetItem("k")).toBe("v");
    });

    it("returns null when the key is not set", () => {
      expect(safeGetItem("missing")).toBeNull();
    });

    it("returns null when window is undefined (SSR)", () => {
      vi.stubGlobal("window", undefined);
      expect(safeGetItem("k")).toBeNull();
    });

    it("returns null when localStorage.getItem throws", () => {
      vi.spyOn(memoryStorage, "getItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });

      expect(safeGetItem("k")).toBeNull();
    });
  });

  describe("safeSetItem", () => {
    it("stores the value and returns true", () => {
      expect(safeSetItem("k", "v")).toBe(true);
      expect(memoryStorage.getItem("k")).toBe("v");
    });

    it("returns false when window is undefined (SSR)", () => {
      vi.stubGlobal("window", undefined);
      expect(safeSetItem("k", "v")).toBe(false);
    });

    it("returns false when localStorage.setItem throws", () => {
      vi.spyOn(memoryStorage, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });

      expect(safeSetItem("k", "v")).toBe(false);
    });
  });
});
