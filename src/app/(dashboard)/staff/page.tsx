import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllStaff } from "@/lib/services/staff-service";
import { StaffsClient } from "@/components/staff/staffs-client";
import type { Staff } from "@/types/staff";

export default async function StaffsPage() {
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

  return <StaffsClient initialStaffs={serializedStaffs} currentUserId={currentUserId} />;
}
