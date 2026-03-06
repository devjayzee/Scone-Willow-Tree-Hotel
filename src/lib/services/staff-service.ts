import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { CreateStaffInput, UpdateStaffInput } from "@/lib/validations/staff";
import { NotFoundError, ConflictError, BusinessRuleError } from "@/lib/errors";

// Re-export error types for convenience
export { NotFoundError, ConflictError, BusinessRuleError };

// Staff select fields for consistent responses
const staffSelectFields = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      bookings: true,
    },
  },
} as const;

// Staff select fields without booking count
const staffSelectFieldsMinimal = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

/**
 * Create a new staff member
 * @throws ConflictError if email already exists
 */
export async function createStaff(data: CreateStaffInput) {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ConflictError("Email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const staff = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: hashedPassword,
      role: data.role ?? "STAFF",
    },
    select: staffSelectFieldsMinimal,
  });

  return staff;
}

/**
 * Update an existing staff member
 * @throws NotFoundError if staff member not found
 * @throws ConflictError if new email already exists
 */
export async function updateStaff(id: string, data: UpdateStaffInput) {
  const existingStaff = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingStaff) {
    throw new NotFoundError("Staff not found");
  }

  // Check if updating email conflicts with another user
  if (data.email && data.email !== existingStaff.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (emailConflict) {
      throw new ConflictError("Email already exists");
    }
  }

  // Build update data
  const updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    role?: "GENERAL_MANAGER" | "STAFF";
    isActive?: boolean;
    tokenVersion?: { increment: number };
  } = {};

  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // Hash password if provided and increment tokenVersion to invalidate sessions
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
    updateData.tokenVersion = { increment: 1 };
  }

  const staff = await prisma.user.update({
    where: { id },
    data: updateData,
    select: staffSelectFieldsMinimal,
  });

  return staff;
}

/**
 * Delete result type
 */
export interface DeleteStaffResult {
  deleted: boolean;
  deactivated: boolean;
  message: string;
}

/**
 * Delete a staff member
 * - If staff has active bookings, deactivates instead of deleting
 * - Prevents self-deletion
 * @throws NotFoundError if staff member not found
 * @throws BusinessRuleError if attempting to delete own account
 */
export async function deleteStaff(id: string, currentUserId: string): Promise<DeleteStaffResult> {
  // Prevent self-deletion
  if (id === currentUserId) {
    throw new BusinessRuleError("Cannot delete your own account");
  }

  const staff = await prisma.user.findUnique({
    where: { id },
    include: {
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
        },
      },
    },
  });

  if (!staff) {
    throw new NotFoundError("Staff not found");
  }

  // If staff has active bookings, deactivate instead of delete
  if (staff.bookings.length > 0) {
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return {
      deleted: false,
      deactivated: true,
      message: "Staff deactivated (has active bookings)",
    };
  }

  await prisma.user.delete({
    where: { id },
  });

  return {
    deleted: true,
    deactivated: false,
    message: "Staff deleted successfully",
  };
}
