/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Second dev server (QA stack on :3010) needs its own dist dir — Next 16's
  // per-.next dev lock refuses two `next dev` in one dir. Unset → '.next'.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Static export — the build output (out/) is served by the FastAPI server
  // (caos/server) in deployment, so the whole app ships as one container.
  output: "export",
  // Emit folder/index.html per route so StaticFiles(html=True) resolves
  // clean URLs like /issuers without extra rewrite logic.
  trailingSlash: true,
  // Keep the export file layout above, but suppress Next's *runtime* trailing-slash
  // redirect. In `next dev` that 308 (/api/x → /api/x/) collides with FastAPI's
  // own slash-stripping 307, ping-ponging until XHR (axios) hangs — which stalls
  // the RequireAuth gate on every page. Dev-only effect; the static export still
  // emits folder/index.html for clean URLs.
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["@antv/g2"],
    // Turbopack's persistent dev cache (<distDir>/dev/cache) grows without
    // bound under HMR churn — reached 41-58GB per dist dir and its ~90MB/s
    // write storms caused system-wide memory-pressure crashes. Cold dev
    // starts are slower; cache-off is the stable trade.
    turbopackFileSystemCacheForDev: false,
  },
  // Dev-only convenience: `next dev` proxies /api to the local FastAPI
  // server. Rewrites are ignored by `next build` in export mode.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
