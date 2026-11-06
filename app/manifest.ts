import type { MetadataRoute } from "next";
import tokens from "@/_brand/tokens.json";
import ms from "@/messages/ms.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: ms.app.name,
    short_name: ms.app.name,
    description: ms.app.tagline,
    lang: "ms",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: tokens.color.background,
    theme_color: tokens.color.primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
