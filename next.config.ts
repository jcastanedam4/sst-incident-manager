import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options for Capacitor/static export */
  reactCompiler: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
