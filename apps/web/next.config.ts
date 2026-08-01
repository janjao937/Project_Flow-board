import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Keep identical — needed to resolve ../../packages/* from apps/web.
const repoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // Required for OpenNext Cloudflare (and our flatten script).
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
};

export default withNextIntl(nextConfig);

// Bindings for local `next dev` with OpenNext (skipped during production builds).
if (process.env.NODE_ENV !== "production") {
  void import("@opennextjs/cloudflare")
    .then(({ initOpenNextCloudflareForDev }) => initOpenNextCloudflareForDev())
    .catch(() => undefined);
}
