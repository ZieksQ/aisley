import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aisley/ui"],
  turbopack: {
    root: "../../",
  },
};

export default nextConfig;
