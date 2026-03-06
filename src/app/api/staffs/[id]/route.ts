import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const updateStaffSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["GENERAL_MANAGER", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/staffs/[id] - Get a single staff member
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const staff = await prisma.user.findUnique({
      where: { id },
      select: {
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
      },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json(staff);
  } catch (error) {
    console.error("Error fetching staff:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    );
  }
}

// PUT /api/staffs/[id] - Update a staff member
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateStaffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const existingStaff = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingStaff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // Check if updating email conflicts with another user
    if (validation.data.email && validation.data.email !== existingStaff.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: validation.data.email },
      });
      if (emailConflict) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 400 }
        );
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
    } = {};

    if (validation.data.firstName) updateData.firstName = validation.data.firstName;
    if (validation.data.lastName) updateData.lastName = validation.data.lastName;
    if (validation.data.email) updateData.email = validation.data.email;
    if (validation.data.role) updateData.role = validation.data.role;
    if (validation.data.isActive !== undefined) updateData.isActive = validation.data.isActive;

    // Hash password if provided
    if (validation.data.password) {
      updateData.password = await bcrypt.hash(validation.data.password, 10);
    }

    const staff = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error("Error updating staff:", error);
    return NextResponse.json(
      { error: "Failed to update staff" },
      { status: 500 }
    );
  }
}

// DELETE /api/staffs/[id] - Delete a staff member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // If staff has active bookings, deactivate instead of delete
    if (staff.bookings.length > 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        message: "Staff deactivated (has active bookings)",
        deactivated: true,
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Staff deleted successfully" });
  } catch (error) {
    console.error("Error deleting staff:", error);
    return NextResponse.json(
      { error: "Failed to delete staff" },
      { status: 500 }
    );
  }
}
