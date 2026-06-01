import nextPwa from "next-pwa";
import { runtimeCaching } from "./lib/pwa/runtime-caching.mjs";

const withPWA = nextPwa({
  dest: "public",
  register: true,
  skipWaiting: false,
  clientsClaim: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  runtimeCaching,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

export default withPWA(nextConfig);
