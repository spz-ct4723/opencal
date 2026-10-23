import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Driver adapter stays external so serverless traces node-postgres itself.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
