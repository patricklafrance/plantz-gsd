import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverExternalPackages: ["@prisma/client", "pg"],
  },
};

export default nextConfig;
