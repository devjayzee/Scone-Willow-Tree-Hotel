import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped forensic context attached to every audit entry created
 * inside a `runWithAuditContext` boundary. Populated at the route
 * handler and read implicitly by `createAuditLog` — services stay
 * session-free (Rule 2) and don't need to thread this through their
 * arguments.
 */
export interface AuditRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

/**
 * Run `fn` with `ctx` available to any `getAuditContext()` call in the
 * same async execution stack. Route handlers wrap their body in this to
 * make request forensics available to nested service calls.
 */
export function runWithAuditContext<T>(
  ctx: AuditRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * Read the current audit context. Returns undefined when called outside
 * a `runWithAuditContext` boundary (e.g. seed scripts, tests) — callers
 * treat that as "no forensics available."
 */
export function getAuditContext(): AuditRequestContext | undefined {
  return storage.getStore();
}
