import { createSerwistRoute } from "@serwist/turbopack";

// useNativeEsbuild is forced on so the build behaves the same on Windows and Vercel.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
