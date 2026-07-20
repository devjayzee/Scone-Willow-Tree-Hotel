// Staff select fields for consistent responses. Includes the count of
// bookings the user has created (used by the /api/staffs list to show a
// per-staff booking count).
export const staffSelectFields = {
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

// Staff select fields without the bookings count — used for create/update
// responses where the count is always 0 for a fresh record.
export const staffSelectFieldsMinimal = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
