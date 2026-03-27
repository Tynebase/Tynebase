import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SOTA Protocol: System Rollback
  // Deactivated React Compiler to resolve Binary Ghost in Vercel build container
  reactCompiler: false,

  // TypeScript logic remains as a top-level authority
  typescript: {
    ignoreBuildErrors: false,
  },

  // Note: eslint and other experimental keys pruned to match Next 16.2.1 schema requirements
};

export default nextConfig;