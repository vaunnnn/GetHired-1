import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Isolate acceptance builds from a running local development server.
  distDir: process.env.GETHIRED_BUILD_DIR || ".next",
  async headers() {
    return ["/dashboard/:path*", "/admin/:path*", "/login/:path*"].map(
      (source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      }),
    )
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",

        hostname: "images.unsplash.com",
      },
    ],
  },
}

export default nextConfig
