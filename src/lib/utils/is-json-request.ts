/** True only for an `application/json` body; blocks cross-site form posts (text/plain, urlencoded, multipart). */
export function isJsonRequest(request: Request): boolean {
  const type = request.headers.get("content-type")?.split(";")[0];
  return type?.trim().toLowerCase() === "application/json";
}
