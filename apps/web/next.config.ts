import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let Next compile the TS source of the shared workspace package.
  transpilePackages: ["@healthyscroll/shared"],
  // Self-contained server for the Docker image (apps/web/Dockerfile).
  output: "standalone",
};

export default nextConfig;
