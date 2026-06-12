/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export — the build output (out/) is served by the FastAPI server
  // (caos/server) in deployment, so the whole app ships as one Databricks App.
  output: "export",
  // Emit folder/index.html per route so StaticFiles(html=True) resolves
  // clean URLs like /issuers without extra rewrite logic.
  trailingSlash: true,
  images: { unoptimized: true },
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
