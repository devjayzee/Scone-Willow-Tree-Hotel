export const authKeys = {
  all: ["auth"] as const,
  invite: (token: string) => [...authKeys.all, "invite", token] as const,
};
