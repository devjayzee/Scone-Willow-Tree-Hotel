import { describe, it, expect, vi, afterEach } from "vitest";
import {
  subscribeToStorage,
  getServerSnapshot,
  dispatchStorageEvent,
  DEFAULT_PAGE_SIZE_OPTIONS,
} from "@/lib/utils/storage-sync";

describe("storage-sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("subscribeToStorage", () => {
    it("registers a storage event listener and returns a cleanup that removes it", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const callback = vi.fn();

      const unsubscribe = subscribeToStorage(callback);

      expect(addSpy).toHaveBeenCalledWith("storage", callback);

      unsubscribe();

      expect(removeSpy).toHaveBeenCalledWith("storage", callback);
    });

    it("invokes the callback when a storage event fires", () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToStorage(callback);

      window.dispatchEvent(new StorageEvent("storage", { key: "k" }));

      expect(callback).toHaveBeenCalledTimes(1);
      unsubscribe();
    });
  });

  describe("getServerSnapshot", () => {
    it("returns null", () => {
      expect(getServerSnapshot()).toBeNull();
    });
  });

  describe("dispatchStorageEvent", () => {
    it("dispatches a storage event with the given key", () => {
      const listener = vi.fn();
      window.addEventListener("storage", listener);

      dispatchStorageEvent("my-key");

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as StorageEvent;
      expect(event.key).toBe("my-key");

      window.removeEventListener("storage", listener);
    });
  });

  describe("DEFAULT_PAGE_SIZE_OPTIONS", () => {
    it("is [10, 20, 50]", () => {
      expect(DEFAULT_PAGE_SIZE_OPTIONS).toEqual([10, 20, 50]);
    });
  });
});
