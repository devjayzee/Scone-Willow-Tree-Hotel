/**
 * Centralized room color configuration
 * Used across calendar components for consistent room color coding
 */

interface RoomColorScheme {
  bg: string;
  dot: string;
  text: string;
  border: string;
}

const roomColors: Record<string, RoomColorScheme> = {
  "1": { bg: "#fef3c7", dot: "#f59e0b", text: "#92400e", border: "#fcd34d" },
  "2": { bg: "#dbeafe", dot: "#3b82f6", text: "#1e40af", border: "#93c5fd" },
  "3": { bg: "#dcfce7", dot: "#22c55e", text: "#166534", border: "#86efac" },
  "4": { bg: "#fce7f3", dot: "#ec4899", text: "#9d174d", border: "#f9a8d4" },
  "5": { bg: "#e0e7ff", dot: "#6366f1", text: "#3730a3", border: "#a5b4fc" },
  "6": { bg: "#fed7aa", dot: "#f97316", text: "#c2410c", border: "#fdba74" },
  "7": { bg: "#d1fae5", dot: "#10b981", text: "#065f46", border: "#6ee7b7" },
  "8": { bg: "#fae8ff", dot: "#d946ef", text: "#86198f", border: "#e879f9" },
};

const defaultColor: RoomColorScheme = {
  bg: "#f3f4f6",
  dot: "#9ca3af",
  text: "#374151",
  border: "#d1d5db",
};

/**
 * Get color scheme for a room number
 * Returns default gray colors if room number not found
 */
export function getRoomColor(roomNumber: string): RoomColorScheme {
  return roomColors[roomNumber] || defaultColor;
}
