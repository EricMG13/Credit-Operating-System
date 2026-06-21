/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export — the build output (out/) is served by the FastAPI server
  // (caos/server) in deployment, so the whole app ships as one Databricks App.
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
  // Lint runs as its own step (npm run lint — ESLint v9 flat config); the
  // legacy in-build `next lint` pass is incompatible with it.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ["@antv/g2"],
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
