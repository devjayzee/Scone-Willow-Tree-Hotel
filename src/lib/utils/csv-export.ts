/**
 * CSV Export Utility
 *
 * Provides functions for exporting data to CSV format and triggering downloads.
 */

/**
 * Convert an array of objects to CSV string
 * @param data - Array of objects to convert
 * @param excludeFields - Fields to exclude from the CSV (e.g., 'id')
 * @returns CSV formatted string
 */
export function convertToCSV<T extends object>(
  data: T[],
  excludeFields: string[] = ["id"]
): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]).filter(
    (key) => !excludeFields.includes(key)
  );

  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = (row as Record<string, unknown>)[header];
          // Handle values that might contain commas or quotes
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? "";
        })
        .join(",")
    ),
  ];

  return csvRows.join("\n");
}

/**
 * Trigger a CSV file download in the browser
 * @param csvContent - CSV string content
 * @param filename - Name of the file (without .csv extension)
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Export data to CSV and trigger download
 * @param data - Array of objects to export
 * @param filename - Name of the file (without .csv extension)
 * @param excludeFields - Fields to exclude from the CSV (default: ['id'])
 */
export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  excludeFields: string[] = ["id"]
): void {
  if (data.length === 0) return;

  const csvContent = convertToCSV(data, excludeFields);
  downloadCSV(csvContent, filename);
}
