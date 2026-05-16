import type { NextConfig } from "next";

const esExportEstatico = process.env.STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  /* Para web/Vercel usar SSR+API; para build estatico (Capacitor) activar STATIC_EXPORT=true */
  ...(esExportEstatico ? { output: "export" as const } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
