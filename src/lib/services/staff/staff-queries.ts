import prisma from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { staffSelectFields } from "./staff-constants";

/**
 * Get all staff members ordered by creation date (newest first)
 */
export async function getAllStaff() {
  const staffs = await prisma.user.findMany({
    select: staffSelectFields,
    orderBy: { createdAt: "desc" },
  });

  return staffs;
}

/**
 * Get a single staff member by ID
 * @throws NotFoundError if staff member not found
 */
export async function getStaffById(id: string) {
  const staff = await prisma.user.findUnique({
    where: { id },
    select: staffSelectFields,
  });

  if (!staff) {
    throw new NotFoundError("Staff not found");
  }

  return staff;
}
