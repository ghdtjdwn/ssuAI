import { afterEach, describe, expect, it, vi } from "vitest";

import { readAgentStream, resumeAgentStream, startAgentStream } from "./agent";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(new Response("data: {}\n\n", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("agent stream client", () => {
  it("includes the library connection hint when starting a stream", async () => {
    const fetchMock = stubFetch();

    await startAgentStream("hi", "thread-1", "mcp-1", true, "access-token");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      message: "hi",
      thread_id: "thread-1",
      mcp_session_id: "mcp-1",
      library_connected: true,
    });
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer access-token",
    });
  });

  it("includes the library connection hint when resuming a stream", async () => {
    const fetchMock = stubFetch();

    await resumeAgentStream("thread-1", false, 7, null, false, null);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      thread_id: "thread-1",
      approved: false,
      action_id: 7,
      mcp_session_id: null,
      library_connected: false,
    });
  });

  it("parses CRLF frames, multi-line data, and an unterminated final frame", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"text",\r\n'));
        controller.enqueue(encoder.encode('data: "content":"hello"}\r\n\r\n'));
        controller.enqueue(encoder.encode('data: {"type":"done"}'));
        controller.close();
      },
    });

    const events = [];
    for await (const event of readAgentStream(new Response(stream))) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "text", content: "hello" },
      { type: "done" },
    ]);
  });

  it("preserves a CRLF delimiter split across chunks", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\r'));
        controller.enqueue(encoder.encode("\n\r"));
        controller.enqueue(encoder.encode("\n"));
        controller.close();
      },
    });

    const events = [];
    for await (const event of readAgentStream(new Response(stream))) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "done" }]);
  });
});
