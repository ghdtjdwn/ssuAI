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
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
