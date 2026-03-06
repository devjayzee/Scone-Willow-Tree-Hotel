import { signOut } from "next-auth/react";

/**
 * Fetch wrapper that handles 401 responses by signing out and redirecting to login
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  // If unauthorized, sign out and redirect to login
  if (response.status === 401) {
    await signOut({ callbackUrl: "/login" });
    throw new Error("Session expired");
  }

  return response;
}
