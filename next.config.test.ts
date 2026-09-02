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
});
