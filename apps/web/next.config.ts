import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let Next compile the TS source of the shared workspace package.
  transpilePackages: ["@healthyscroll/shared"],
};

export default nextConfig;
