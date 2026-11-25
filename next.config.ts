import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSerwist } from "@serwist/turbopack";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  agentRules: false,
  // Logo uploads are up to 1 MB; the form around them needs a little more.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // lib/prayer-times.ts reads the bundled fallback from disk on the server.
  outputFileTracingIncludes: {
    "/**": ["./data/prayer-times/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(withSerwist(nextConfig));
