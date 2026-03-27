import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pruning invalid keys to stabilize the kernel
  experimental: {
    // reactCompiler is now a standard experimental flag
    // but if it keeps failing, set to false to ship today.
    reactCompiler: true, 
  },
  // Stop Next.js from hunting in the parent directory
  typescript: {
    ignoreBuildErrors: false, // Keep your standards high
  },
  eslint: {
    ignoreDuringBuilds: false,
  }
};

export default nextConfig;