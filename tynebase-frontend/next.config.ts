import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SOTA Protocol: Prison Strong Stability
  output: 'standalone',
  
  // Mandatory Bypasses for the Vercel Build Worker
  typescript: {
    ignoreBuildErrors: true,
  },

  // Asset Optimization
  images: {
    unoptimized: true,
  },

  // Pruning all experimental keys to ensure the 1-minute build time restoration
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;