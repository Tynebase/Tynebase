// tynebase-frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // KILL THE GHOST: Set this to false
    reactCompiler: false, 
    turbopack: {
      // Ensure Turbopack knows its own root
      root: '.', 
    },
  },
  /* rest of your config */
};

export default nextConfig;