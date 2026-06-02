import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  // Increase body size limit untuk upload file besar (2GB)
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
