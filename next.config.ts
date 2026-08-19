import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native SQLite module and driver adapters in node_modules at runtime
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
  ],
};

export default nextConfig;
