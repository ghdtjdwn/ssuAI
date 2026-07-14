import { afterEach, describe, expect, it, vi } from "vitest";

import { deriveServerPrincipal, proxyToAgent, stripAndInjectPrincipal } from "./agentProxy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("stripAndInjectPrincipal", () => {
  it("strips a client-sent principal when no server principal is available", () => {
    const raw = JSON.stringify({ message: "hi", thread_id: "t1", principal: "student:12345" });

    const result = JSON.parse(stripAndInjectPrincipal(raw, null)) as Record<string, unknown>;

    expect(result.principal).toBeUndefined();
    expect(result.message).toBe("hi");
    expect(result.thread_id).toBe("t1");
  });

  it("injects the server-derived principal, discarding any client-sent value", () => {
    const raw = JSON.stringify({ message: "hi", principal: "student:client-supplied" });

    const result = JSON.parse(stripAndInjectPrincipal(raw, "student:server-verified")) as Record<string, unknown>;

    expect(result.principal).toBe("student:server-verified");
  });

  it("forwards without a principal field when neither client nor server supplies one", () => {
    const raw = JSON.stringify({ message: "hi", thread_id: "t1", mcp_session_id: "s1" });

    const result = JSON.parse(stripAndInjectPrincipal(raw, null)) as Record<string, unknown>;

    expect("principal" in result).toBe(false);
    expect(result).toEqual({ message: "hi", thread_id: "t1", mcp_session_id: "s1" });
  });

  it("injects a server principal even when the client sent none at all", () => {
    const raw = JSON.stringify({ message: "hi" });

    const result = JSON.parse(stripAndInjectPrincipal(raw, "student:server-verified")) as Record<string, unknown>;

    expect(result.principal).toBe("student:server-verified");
  });

  it("returns malformed JSON bodies unchanged (ssuAgent rejects them itself)", () => {
    const raw = "not json";

    expect(stripAndInjectPrincipal(raw, "student:server-verified")).toBe(raw);
  });

  it("returns non-object JSON bodies (arrays, primitives) unchanged", () => {
    expect(stripAndInjectPrincipal("[1,2,3]", "student:x")).toBe("[1,2,3]");
    expect(stripAndInjectPrincipal("42", "student:x")).toBe("42");
  });
});

describe("deriveServerPrincipal", () => {
  it("returns null when the browser did not send an access token", async () => {
    const request = new Request("https://ssuai.example/api/agent/stream", { method: "POST" });

    await expect(deriveServerPrincipal(request)).resolves.toBeNull();
  });

  it("uses only the subject verified by ssuMCP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { studentId: "20201234" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      headers: { Authorization: "Bearer access-jwt" },
    });

    await expect(deriveServerPrincipal(request)).resolves.toBe("20201234");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/auth/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-jwt", Accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("fails closed when an access token is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      headers: { Authorization: "Bearer expired-jwt" },
    });

    await expect(deriveServerPrincipal(request)).rejects.toMatchObject({ status: 401 });
  });

  it("fails closed when the verifier is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      headers: { Authorization: "Bearer access-jwt" },
    });

    await expect(deriveServerPrincipal(request)).rejects.toMatchObject({ status: 503 });
  });
});

describe("proxyToAgent", () => {
  function stubFetchOnce(status = 200) {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("data: {}\n\n", {
        status,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("strips a client-sent principal before forwarding to ssuAgent", async () => {
    const fetchMock = stubFetchOnce();
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      body: JSON.stringify({ message: "hi", thread_id: "t1", principal: "student:client-supplied" }),
    });

    await proxyToAgent("/agent/stream", request);

    const forwardedBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(forwardedBody.principal).toBeUndefined();
    expect(forwardedBody.message).toBe("hi");
  });

  it("injects only a principal verified by ssuMCP and never forwards the bearer token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { studentId: "20201234" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response("data: {}\n\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      headers: { Authorization: "Bearer access-jwt" },
      body: JSON.stringify({ message: "hi", principal: "client-asserted" }),
    });

    await proxyToAgent("/agent/stream", request);

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ message: "hi", principal: "20201234" });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("forwards without a principal field when the client sends none", async () => {
    const fetchMock = stubFetchOnce();
    const request = new Request("https://ssuai.example/api/agent/resume", {
      method: "POST",
      body: JSON.stringify({ thread_id: "t1", approved: true, action_id: 1, mcp_session_id: "s1" }),
    });

    await proxyToAgent("/agent/resume", request);

    const forwardedBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect("principal" in forwardedBody).toBe(false);
    expect(forwardedBody).toEqual({ thread_id: "t1", approved: true, action_id: 1, mcp_session_id: "s1" });
  });

  it("does not call ssuAgent when bearer verification fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      headers: { Authorization: "Bearer expired-jwt" },
      body: JSON.stringify({ message: "hi", thread_id: "t1" }),
    });

    const response = await proxyToAgent("/agent/stream", request);

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 503 without calling ssuAgent when principal verification is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      headers: { Authorization: "Bearer access-jwt" },
      body: JSON.stringify({ message: "hi", thread_id: "t1" }),
    });

    const response = await proxyToAgent("/agent/stream", request);

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forwards to the configured ssuAgent base URL and path", async () => {
    const fetchMock = stubFetchOnce();
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      body: JSON.stringify({ message: "hi" }),
    });

    await proxyToAgent("/agent/stream", request);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ssuagent.duckdns.org/agent/stream");
  });

  it("fails closed before any upstream call when the production proxy key is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("AGENT_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      body: JSON.stringify({ message: "hi", thread_id: "t1" }),
    });

    const response = await proxyToAgent("/agent/stream", request);

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
