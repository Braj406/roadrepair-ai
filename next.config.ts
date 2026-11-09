import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 defaults from create-next-app: cached server components and partial prefetching.
  cacheComponents: true,
  partialPrefetching: true,
  // Run Tailwind CSS through Turbopack.
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
