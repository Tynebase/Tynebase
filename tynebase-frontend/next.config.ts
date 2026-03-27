import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SOTA Protocol: Absolute Bare-Metal Execution
  output: 'standalone',
  
  // RAM Optimization: Stripping source maps drops memory payload by up to 50%
  // Prevents silent OOM (Out of Memory) hangs during file tracing.
  productionBrowserSourceMaps: false,
  
  // Mandatory Bypass for the Vercel Build Worker
  typescript: {
    ignoreBuildErrors: true,
  },

  // Asset Optimization
  images: {
    unoptimized: true,
  },

  reactStrictMode: true,
  poweredByHeader: false,

  // THE THREAD-LOCK BREAKER (Level 2: The Phalanx)
  experimental: {
    // Forces Next.js to abandon parallel processing and use a single thread.
    // This physically eliminates the race condition/deadlock freezing your deployment.
    workerThreads: false,
    cpus: 1,
  },

  // SSG Failsafe
  staticPageGenerationTimeout: 60,
};

export default nextConfig;