import { afterEach, describe, expect, it, vi } from "vitest";

import { deriveServerPrincipal, proxyToAgent, stripAndInjectPrincipal } from "./agentProxy";

afterEach(() => {
  vi.unstubAllGlobals();
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
  it("returns null: no server-verified identity source is wired to this route yet", () => {
    const request = new Request("https://ssuai.example/api/agent/stream", { method: "POST" });

    expect(deriveServerPrincipal(request)).toBeNull();
  });

  it("ignores any Authorization header on the request (no verification infra exists to trust it)", () => {
    const request = new Request("https://ssuai.example/api/agent/stream", {
      method: "POST",
      headers: { Authorization: "Bearer some-jwt" },
    });

    expect(deriveServerPrincipal(request)).toBeNull();
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
});
