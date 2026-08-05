import {
  createAuditLog,
  AuditAction,
  EntityType,
  sanitizeForAudit,
  getChangedFields,
} from "../audit-service";
import type { UpdateStaffSchemaInput } from "@/lib/validations/staff";

/**
 * Classify what changed on a staff update and write the matching audit entries.
 * Fires nothing when performedBy is undefined. Preserves the four-way branching
 * originally inlined in updateStaff: password / role / active-status / general.
 */
export async function logStaffUpdateAudits(
  id: string,
  existingStaff: Record<string, unknown>,
  data: UpdateStaffSchemaInput,
  performedBy?: string,
): Promise<void> {
  if (!performedBy) return;

  const passwordChanged = !!data.password;
  const roleChanged = data.role && data.role !== existingStaff.role;
  const activeStatusChanged =
    data.isActive !== undefined && data.isActive !== existingStaff.isActive;

  if (passwordChanged) {
    await createAuditLog(
      performedBy,
      AuditAction.STAFF_PASSWORD_CHANGED,
      EntityType.STAFF,
      id,
      { reason: "Password updated" },
    );
  }

  if (roleChanged) {
    await createAuditLog(
      performedBy,
      AuditAction.STAFF_ROLE_CHANGED,
      EntityType.STAFF,
      id,
      {
        previous: { role: existingStaff.role },
        current: { role: data.role },
      },
    );
  }

  if (activeStatusChanged) {
    await createAuditLog(
      performedBy,
      data.isActive
        ? AuditAction.STAFF_ACTIVATED
        : AuditAction.STAFF_DEACTIVATED,
      EntityType.STAFF,
      id,
      {
        previous: { isActive: existingStaff.isActive },
        current: { isActive: data.isActive },
      },
    );
  }

  const changedFields = getChangedFields(
    existingStaff,
    data as Record<string, unknown>,
  );

  if (
    changedFields.length > 0 &&
    !passwordChanged &&
    !roleChanged &&
    !activeStatusChanged
  ) {
    await createAuditLog(
      performedBy,
      AuditAction.STAFF_UPDATED,
      EntityType.STAFF,
      id,
      {
        previous: sanitizeForAudit(
          Object.fromEntries(
            changedFields.map((f) => [f, existingStaff[f]]),
          ),
        ),
        current: sanitizeForAudit(
          Object.fromEntries(
            changedFields.map((f) => [f, (data as Record<string, unknown>)[f]]),
          ),
        ),
        changedFields,
      },
    );
  }
}
