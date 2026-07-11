import { afterEach, describe, expect, it, vi } from "vitest";

import { resumeAgentStream, startAgentStream } from "./agent";

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

    await startAgentStream("hi", "thread-1", "mcp-1", true);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      message: "hi",
      thread_id: "thread-1",
      mcp_session_id: "mcp-1",
      library_connected: true,
    });
  });

  it("includes the library connection hint when resuming a stream", async () => {
    const fetchMock = stubFetch();

    await resumeAgentStream("thread-1", false, 7, null, false);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      thread_id: "thread-1",
      approved: false,
      action_id: 7,
      mcp_session_id: null,
      library_connected: false,
    });
  });
});
