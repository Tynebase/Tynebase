import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SOTA Protocol: reactCompiler is now a top-level key in Next 15/16
  reactCompiler: true,

  // ESLint and TypeScript are also top-level, not nested in experimental
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;