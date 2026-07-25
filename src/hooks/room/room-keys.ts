export const roomKeys = {
  all: ["rooms"] as const,
  lists: () => [...roomKeys.all, "list"] as const,
  list: () => [...roomKeys.lists()] as const,
  details: () => [...roomKeys.all, "detail"] as const,
  detail: (id: string) => [...roomKeys.details(), id] as const,
  available: (checkIn: string, checkOut: string) =>
    [...roomKeys.all, "available", checkIn, checkOut] as const,
};
