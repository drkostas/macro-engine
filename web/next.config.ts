import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // macro-engine-core ships subpath exports; Turbopack needs it transpiled to
  // resolve the subpaths + bundle it into the standalone output.
  transpilePackages: ["macro-engine-core"],
};

export default nextConfig;
