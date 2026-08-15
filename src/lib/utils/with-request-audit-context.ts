import { runWithAuditContext } from "@/lib/services/audit-context";
import { getClientIp } from "@/lib/utils/get-client-ip";

/**
 * Wrap a route handler body so every `createAuditLog` call inside it
 * picks up the caller's IP and User-Agent via AsyncLocalStorage.
 * Read-only routes don't need this; use only on mutating handlers.
 *
 * ```ts
 * export async function POST(request: Request) {
 *   return withRequestAuditContext(request, async () => {
 *     // existing try/catch handler body
 *   });
 * }
 * ```
 */
export function withRequestAuditContext<T>(
  req: Request,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithAuditContext(
    {
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    fn,
  );
}
