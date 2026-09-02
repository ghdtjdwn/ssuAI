import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPolicyCase,
  decideReviewerPolicyCase,
  listPolicyCases,
  listReviewerPolicyCases,
} from "./copilot";

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(data: unknown) {
  return Response.json({ data, error: null, traceId: "trace-copilot" });
}

describe("policy copilot API", () => {
  it("uses the same-origin API envelope and bearer token for a case submission", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPolicyCase("token", { question: "졸업 요건은?", category: "graduation" })).resolves.toEqual({
      id: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/copilot/policy-cases",
      expect.objectContaining({ method: "POST" }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      question: "졸업 요건은?",
      category: "graduation",
    }));
  });

  it("loads the current principal's recent cases with the bearer token and abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: 1 }]));
    const controller = new AbortController();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listPolicyCases("token", controller.signal)).resolves.toEqual([{ id: 1 }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/copilot/policy-cases",
      expect.objectContaining({ signal: controller.signal }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined();
  });

  it("adds a reviewer status filter and posts an optimistic version", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await listReviewerPolicyCases("reviewer", "PENDING_REVIEW");
    await decideReviewerPolicyCase("reviewer", 1, {
      expectedVersion: 3,
      decision: "REJECT",
      rejectionReason: "근거가 부족합니다.",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/reviewer/policy-cases?status=PENDING_REVIEW");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/reviewer/policy-cases/1/decision");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        expectedVersion: 3,
        decision: "REJECT",
        rejectionReason: "근거가 부족합니다.",
      }),
    });
  });
});
