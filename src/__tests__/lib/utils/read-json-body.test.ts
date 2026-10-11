import { describe, it, expect } from "vitest";
import { AppError } from "@/lib/errors";
import { readJsonBody } from "@/lib/utils/read-json-body";

function post(body: string) {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("readJsonBody", () => {
  it("returns the parsed value for valid JSON", async () => {
    await expect(readJsonBody(post('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it.each([["a malformed body", "{not json"], ["an empty body", ""]])(
    "throws a 400 INVALID_JSON AppError for %s",
    async (_label, body) => {
      const result = readJsonBody(post(body));

      await expect(result).rejects.toBeInstanceOf(AppError);
      await expect(result).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_JSON",
        message: "Request body must be valid JSON",
      });
    }
  );

  it("rethrows a non-SyntaxError unchanged", async () => {
    const request = post('{"a":1}');
    await readJsonBody(request);

    const error: unknown = await readJsonBody(request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(AppError);
  });
});
