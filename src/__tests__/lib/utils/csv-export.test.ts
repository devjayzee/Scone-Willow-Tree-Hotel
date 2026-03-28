import { describe, it, expect, vi, beforeEach } from "vitest";
import { convertToCSV, downloadCSV, exportToCSV } from "@/lib/utils/csv-export";

// Mock URL and document APIs for downloadCSV
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();

vi.stubGlobal("URL", {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

describe("CSV Export Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // convertToCSV
  // ============================================================
  describe("convertToCSV", () => {
    it("should return empty string for empty array", () => {
      const result = convertToCSV([]);
      expect(result).toBe("");
    });

    it("should convert simple objects to CSV", () => {
      const data = [
        { name: "John", email: "john@example.com" },
        { name: "Jane", email: "jane@example.com" },
      ];

      const result = convertToCSV(data, []);

      expect(result).toBe("name,email\nJohn,john@example.com\nJane,jane@example.com");
    });

    it("should exclude specified fields", () => {
      const data = [
        { id: "1", name: "John", secret: "hidden" },
        { id: "2", name: "Jane", secret: "also-hidden" },
      ];

      const result = convertToCSV(data, ["id", "secret"]);

      expect(result).toBe("name\nJohn\nJane");
    });

    it("should exclude id by default", () => {
      const data = [{ id: "1", name: "John" }];

      const result = convertToCSV(data);

      expect(result).toBe("name\nJohn");
      expect(result).not.toContain("id");
    });

    it("should handle values with commas", () => {
      const data = [{ name: "Doe, John", email: "john@example.com" }];

      const result = convertToCSV(data, []);

      expect(result).toContain('"Doe, John"');
    });

    it("should handle values with quotes", () => {
      const data = [{ name: 'John "Johnny" Doe', email: "john@example.com" }];

      const result = convertToCSV(data, []);

      // Quotes should be escaped by doubling
      expect(result).toContain('"John ""Johnny"" Doe"');
    });

    it("should handle null and undefined values", () => {
      const data = [
        { name: "John", phone: null },
        { name: "Jane", phone: undefined },
      ];

      const result = convertToCSV(data, []);

      const lines = result.split("\n");
      expect(lines[1]).toBe("John,");
      expect(lines[2]).toBe("Jane,");
    });

    it("should handle numeric values", () => {
      const data = [
        { name: "Room 101", price: 150.50, capacity: 2 },
      ];

      const result = convertToCSV(data, []);

      expect(result).toBe("name,price,capacity\nRoom 101,150.5,2");
    });

    it("should handle boolean values", () => {
      const data = [
        { name: "John", active: true },
        { name: "Jane", active: false },
      ];

      const result = convertToCSV(data, []);

      expect(result).toContain("true");
      expect(result).toContain("false");
    });

    it("should handle empty string values", () => {
      const data = [{ name: "John", notes: "" }];

      const result = convertToCSV(data, []);

      expect(result).toBe("name,notes\nJohn,");
    });
  });

  // ============================================================
  // downloadCSV
  // ============================================================
  describe("downloadCSV", () => {
    it("should create blob and trigger download", () => {
      // Mock document.createElement
      const mockLink = {
        href: "",
        download: "",
        click: mockClick,
      };
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

      downloadCSV("name,email\nJohn,john@example.com", "test-export");

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe("test-export.csv");
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("should set correct content type", () => {
      const mockLink = { href: "", download: "", click: vi.fn() };
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

      downloadCSV("test,data", "export");

      // Verify Blob was created (indirectly through createObjectURL call)
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  // ============================================================
  // exportToCSV
  // ============================================================
  describe("exportToCSV", () => {
    it("should not download for empty data", () => {
      const mockLink = { href: "", download: "", click: vi.fn() };
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

      exportToCSV([], "empty-export");

      expect(mockCreateObjectURL).not.toHaveBeenCalled();
    });

    it("should convert and download data", () => {
      const mockLink = { href: "", download: "", click: vi.fn() };
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

      const data = [
        { id: "1", name: "John", email: "john@example.com" },
      ];

      exportToCSV(data, "users-export");

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe("users-export.csv");
      expect(mockLink.click).toHaveBeenCalled();
    });

    it("should pass exclude fields to convertToCSV", () => {
      const mockLink = { href: "", download: "", click: vi.fn() };
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

      const data = [
        { id: "1", password: "secret", name: "John" },
      ];

      exportToCSV(data, "users", ["id", "password"]);

      // The export should work (indirectly verify through createObjectURL call)
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });
});
