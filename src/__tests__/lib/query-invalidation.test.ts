import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateWithRelated } from "@/lib/query-invalidation";
import { bookingKeys } from "@/hooks/booking/booking-keys";
import { roomKeys } from "@/hooks/room/room-keys";
import { calendarKeys } from "@/hooks/use-calendar";
import { reportKeys } from "@/hooks/use-reports";
import { staffKeys } from "@/hooks/staff/staff-keys";

function makeQueryClient() {
  const invalidateQueries = vi.fn();
  return {
    client: { invalidateQueries } as unknown as QueryClient,
    invalidateQueries,
  };
}

describe("invalidateWithRelated", () => {
  let qc: ReturnType<typeof makeQueryClient>;

  beforeEach(() => {
    qc = makeQueryClient();
  });

  it("bookings invalidates itself + calendar + reports", () => {
    invalidateWithRelated(qc.client, "bookings");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bookings"],
    });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["calendar"],
    });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports"] });
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(3);
  });

  it("rooms invalidates itself + bookings + calendar + reports", () => {
    invalidateWithRelated(qc.client, "rooms");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["rooms"] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["bookings"],
    });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["calendar"],
    });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports"] });
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(4);
  });

  it("calendar invalidates only itself", () => {
    invalidateWithRelated(qc.client, "calendar");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["calendar"],
    });
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("reports invalidates only itself", () => {
    invalidateWithRelated(qc.client, "reports");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["reports"] });
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("staffs invalidates only itself (was previously a silent no-op)", () => {
    invalidateWithRelated(qc.client, "staffs");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["staffs"] });
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("accepts every key factory's all[0] as a valid primary key — drift guard", () => {
    // If any factory renames its `all` array (e.g. staffKeys.all: ["staffs"]
    // becomes ["staff"]) without a matching update in
    // CACHE_RELATIONSHIPS, the corresponding call below fails to
    // typecheck. The runtime asserts also cover the invalidation
    // wiring end-to-end.
    invalidateWithRelated(qc.client, bookingKeys.all[0]);
    invalidateWithRelated(qc.client, roomKeys.all[0]);
    invalidateWithRelated(qc.client, calendarKeys.all[0]);
    invalidateWithRelated(qc.client, reportKeys.all[0]);
    invalidateWithRelated(qc.client, staffKeys.all[0]);
    // 3 (bookings + calendar + reports) + 4 (rooms + related) + 1 + 1 + 1 = 10
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(10);
  });
});
