import type { NextConfig } from "next";

const rawApiProxyTarget =
  process.env.SSUAI_API_PROXY_TARGET?.trim() ||
  process.env.NEXT_PUBLIC_SSUAI_API_BASE?.trim() ||
  "http://localhost:8080";
const apiProxyTarget = rawApiProxyTarget.replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    // The developer home contains an unrelated package-lock.json. Pinning the
    // root keeps Next.js file tracing and cache keys scoped to this repository.
    root: process.cwd(),
  },
  async headers() {
    return [
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
    ];
  },
  async rewrites() {
    return {
      // The campus backend is the legacy API fallback. Keeping this rewrite in
      // the fallback phase lets every local App Router handler—including
      // dynamic `/api/agent/threads/[threadId]`—win first.
      fallback: [
        {
          source: "/api/:path*",
          destination: `${apiProxyTarget}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
