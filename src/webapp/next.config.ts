import path from "node:path";
import type { NextConfig } from "next";

const imageSourceUrls = [
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  process.env.NEXT_PUBLIC_MEDIA_URL,
  "https://images.unsplash.com",
].filter((value): value is string => Boolean(value));

const remotePatterns = imageSourceUrls.flatMap((value) => {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return [];
    }

    return [
      {
        protocol: url.protocol === "https:" ? ("https" as const) : ("http" as const),
        hostname: url.hostname,
        port: url.port,
        pathname: "/**",
      },
    ];
  } catch {
    return [];
  }
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
  transpilePackages: ["@aisley/ui"],
  turbopack: {
    // root: "../../",
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
