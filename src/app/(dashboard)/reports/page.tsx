import { getRoomPerformance } from "@/lib/services/report-service";
import { ReportsClient } from "@/components/report/reports-client";
import type { RoomPerformanceData } from "@/types/report";

// Revalidate every 60 seconds - aggregate data, slight staleness acceptable
export const revalidate = 60;

export default async function ReportsPage() {
  // Track when data was fetched for cache freshness
  const fetchTime = Date.now();

  // Fetch initial data server-side
  const roomPerformance = await getRoomPerformance();

  // Serialize data for client component (already serialized in service)
  const serializedData: RoomPerformanceData[] = roomPerformance;

  return <ReportsClient initialData={serializedData} fetchTime={fetchTime} />;
}
