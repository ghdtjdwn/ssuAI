import { z } from "zod";

import { fetchJson } from "./client";

function summarizeIssues(issues: z.ZodError["issues"]): string {
  return issues
    .slice(0, 5)
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export class ApiSchemaError extends Error {
  constructor(
    public path: string,
    public issues: z.ZodError["issues"],
  ) {
    super(`Response schema mismatch for ${path}: ${summarizeIssues(issues)}`);
    this.name = "ApiSchemaError";
  }
}

/**
 * `fetchJson` + runtime schema validation at the network boundary.
 *
 * `fetchJson<T>`'s `T` is a compile-time assertion with no runtime check: when the
 * backend payload shape drifts, the UI can silently render empty states while types
 * and mocked tests stay green (see ADR 0010 §5). This wrapper validates the
 * envelope-unwrapped payload against a zod schema and throws an `ApiSchemaError`
 * naming the request path and the offending fields, so React Query surfaces an
 * error state instead of an empty UI.
 */
export async function fetchJsonParsed<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  const payload = await fetchJson<unknown>(path, init);
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiSchemaError(path, result.error.issues);
  }
  return result.data;
}
