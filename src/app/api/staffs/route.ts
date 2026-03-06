import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createStaffSchema } from "@/lib/validations/staff";
import { getAllStaff, createStaff } from "@/lib/services/staff-service";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api-error-handler";

// GET /api/staffs - Get all staff members
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only managers can view staff list");
    }

    const staffs = await getAllStaff();
    return NextResponse.json(staffs);
  } catch (error) {
    return handleApiError(error, "fetching staffs");
  }
}

// POST /api/staffs - Create a new staff member
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only managers can create staff");
    }

    const body = await request.json();
    const validation = createStaffSchema.safeParse(body);

    if (!validation.success) {
      return handleApiError(validation.error, "creating staff");
    }

    const staff = await createStaff(validation.data);
    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    return handleApiError(error, "creating staff");
  }
}
