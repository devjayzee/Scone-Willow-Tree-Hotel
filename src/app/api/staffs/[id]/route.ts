import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateStaffSchema } from "@/lib/validations/staff";
import {
  getStaffById,
  updateStaff,
  deleteStaff,
} from "@/lib/services/staff";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api-error-handler";
import { withRequestAuditContext } from "@/lib/utils/with-request-audit-context";

// GET /api/staffs/[id] - Get a single staff member
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    if (session.user.role !== "GENERAL_MANAGER") {
      throw new ForbiddenError("Only managers can view staff details");
    }

    const { id } = await params;
    const staff = await getStaffById(id);

    return NextResponse.json(staff);
  } catch (error) {
    return handleApiError(error, "fetching staff");
  }
}

// PUT /api/staffs/[id] - Update a staff member
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestAuditContext(request, async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        throw new UnauthorizedError();
      }

      if (session.user.role !== "GENERAL_MANAGER") {
        throw new ForbiddenError("Only managers can update staff");
      }

      const { id } = await params;
      const body = await request.json();
      const validation = updateStaffSchema.safeParse(body);

      if (!validation.success) {
        return handleApiError(validation.error, "updating staff");
      }

      const staff = await updateStaff(id, validation.data, session.user.id);

      return NextResponse.json(staff);
    } catch (error) {
      return handleApiError(error, "updating staff");
    }
  });
}

// DELETE /api/staffs/[id] - Delete a staff member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestAuditContext(request, async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        throw new UnauthorizedError();
      }

      if (session.user.role !== "GENERAL_MANAGER") {
        throw new ForbiddenError("Only managers can delete staff");
      }

      const { id } = await params;
      const result = await deleteStaff(id, session.user.id);

      return NextResponse.json({
        message: result.message,
        deactivated: result.deactivated,
      });
    } catch (error) {
      return handleApiError(error, "deleting staff");
    }
  });
}
