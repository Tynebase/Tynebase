// next.config.ts refactor snippet
const nextConfig = {
  experimental: {
    reactCompiler: true,
    turbopack: {
      root: '.', // Forces resolution to the current directory
    },
  },
};