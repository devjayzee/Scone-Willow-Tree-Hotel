import { requireSession } from "@/lib/auth-guard";
import { getAllStaff } from "@/lib/services/staff";
import { StaffsClient } from "@/components/staff/staffs-client";
import type { Staff } from "@/types/staff";

// requireSession() reads cookies, which forces dynamic rendering — the
// declaration is here so future readers don't wonder why the page isn't
// cached.
export const dynamic = "force-dynamic";

export default async function StaffsPage() {
  // Track when data was fetched for cache freshness
  const fetchTime = Date.now();

  const session = await requireSession("GENERAL_MANAGER");
  const currentUserId = session.user.id;

  // Fetch staffs server-side
  const staffs = await getAllStaff();

  // Serialize dates for client component
  const serializedStaffs: Staff[] = staffs.map((staff) => ({
    id: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    role: staff.role,
    isActive: staff.isActive,
    createdAt: staff.createdAt.toISOString(),
    updatedAt: staff.updatedAt.toISOString(),
    _count: staff._count,
  }));

  return (
    <StaffsClient
      initialStaffs={serializedStaffs}
      currentUserId={currentUserId}
      fetchTime={fetchTime}
    />
  );
}
