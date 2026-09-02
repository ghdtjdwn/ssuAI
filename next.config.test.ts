import nextConfig from "./next.config";

describe("Next.js API routing", () => {
  it("proxies the campus API only after dynamic route handlers", async () => {
    const rewrites = await nextConfig.rewrites?.();

    expect(rewrites).toBeDefined();
    expect(Array.isArray(rewrites)).toBe(false);
    if (!rewrites || Array.isArray(rewrites)) {
      throw new Error("API proxy must be configured as a fallback rewrite");
    }

    expect(rewrites).not.toHaveProperty("beforeFiles");
    expect(rewrites).not.toHaveProperty("afterFiles");
    expect(rewrites.fallback).toEqual([
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
    ]);
  });

  it("sets baseline browser security headers without changing routing", async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toEqual([
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]);
  });
});
