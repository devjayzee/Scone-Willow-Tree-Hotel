import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllStaff } from "@/lib/services/staff";
import { StaffsClient } from "@/components/staff/staffs-client";
import type { Staff } from "@/types/staff";

// Revalidate every 5 minutes - staff data rarely changes
export const revalidate = 300;

export default async function StaffsPage() {
  // Track when data was fetched for cache freshness
  const fetchTime = Date.now();

  // Get current user session
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id;

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
