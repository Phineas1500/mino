import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/:path*", // Match anything
        has: [
          {
            type: "host",
            value: "www.minomize.com",
          },
        ],
        destination: "https://minomize.com/:path*", // Redirect and keep the path
        permanent: true, // 308 Permanent Redirect
      },
    ];
  },
};

export default nextConfig;
