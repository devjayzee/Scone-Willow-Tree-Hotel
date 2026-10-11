import { AppError } from "@/lib/errors";

/** Parses the request body as JSON; a malformed body throws a 400 INVALID_JSON AppError. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AppError("Request body must be valid JSON", 400, "INVALID_JSON");
    }
    throw error;
  }
}
