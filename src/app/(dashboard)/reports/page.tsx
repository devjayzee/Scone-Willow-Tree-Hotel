import { getRoomPerformance } from "@/lib/services/report-service";
import { ReportsClient } from "@/components/report/reports-client";
import type { RoomPerformanceData } from "@/types/report";

export default async function ReportsPage() {
  // Fetch initial data server-side
  const roomPerformance = await getRoomPerformance();

  // Serialize data for client component (already serialized in service)
  const serializedData: RoomPerformanceData[] = roomPerformance;

  return <ReportsClient initialData={serializedData} />;
}
