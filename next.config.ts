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
  // lib/pdf/receipt.ts reads the PDF fonts, lib/receipts.ts the SVG drawer, from disk.
  outputFileTracingIncludes: {
    "/**": ["./data/prayer-times/**", "./lib/pdf/fonts/**", "./node_modules/@resvg/resvg-wasm/**"],
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
