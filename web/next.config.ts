import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export estático: sin servidor (CLAUDE.md, Decisión de cómputo)
  output: "export",
  images: { unoptimized: true },
  // Sin cacheComponents ni partialPrefetching: usan PPR, que no funciona con output: "export"
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
