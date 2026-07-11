import { afterEach, describe, expect, it, vi } from "vitest";

import { exchangeAuthCode } from "./auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exchangeAuthCode", () => {
  it("POSTs the one-time code to /api/auth/exchange with credentials included", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: { accessToken: "access.jwt", accessTtlSeconds: 900 },
        error: null,
        traceId: "trace-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeAuthCode("one-time-code")).resolves.toEqual({
      accessToken: "access.jwt",
      accessTtlSeconds: 900,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/exchange");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({ code: "one-time-code" });
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("propagates the ApiError on an invalid/expired/reused code (401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            data: null,
            error: { code: "UNAUTHORIZED", message: "invalid or expired code" },
            traceId: "trace-2",
          },
          { status: 401 },
        ),
      ),
    );

    await expect(exchangeAuthCode("bad-code")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      httpStatus: 401,
    });
  });
});
