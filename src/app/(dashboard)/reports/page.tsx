import { requireSession } from "@/lib/auth-guard";
import { getRoomPerformance } from "@/lib/services/report";
import { ReportsClient } from "@/components/report/reports-client";
import type { RoomPerformanceData } from "@/types/report";

// requireSession() reads cookies, which forces dynamic rendering — the
// declaration is here so future readers don't wonder why the page isn't
// cached (previously `revalidate = 60` silently served an anonymous
// ISR-cached artifact because nothing else in the render path was
// dynamic).
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // Track when data was fetched for cache freshness
  const fetchTime = Date.now();

  await requireSession(["MANAGER", "GENERAL_MANAGER"]);

  // Fetch initial data server-side
  const roomPerformance = await getRoomPerformance();

  // Serialize data for client component (already serialized in service)
  const serializedData: RoomPerformanceData[] = roomPerformance;

  return <ReportsClient initialData={serializedData} fetchTime={fetchTime} />;
}
