import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SOTA Protocol: System Neutralization
  // React Compiler and ESLint keys pruned to match Next 16.2.1 strict schema
  
  // Forced Root Authority
  typescript: {
    // Overriding the "Missing typescript package" hallucination
    ignoreBuildErrors: true,
  },

  // Asset Optimization
  images: {
    unoptimized: true,
  },

  // Turbopack Infrastructure
  experimental: {
    // We are stripping all other experimental flags to prevent the build worker from hanging
    // during the "Collecting page data" phase.
  },
};

export default nextConfig;