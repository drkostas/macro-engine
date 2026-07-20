import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` is for Docker self-hosting. On Vercel it corrupts the Edge
  // middleware bundle (pulls in Node-only `__dirname` → MIDDLEWARE_INVOCATION_FAILED),
  // so only enable it off-Vercel; Vercel uses its own optimized output.
  output: process.env.VERCEL ? undefined : "standalone",
  // macro-engine-core ships subpath exports; Turbopack needs it transpiled to
  // resolve the subpaths + bundle it into the standalone output.
  transpilePackages: ["macro-engine-core"],
};

export default nextConfig;
