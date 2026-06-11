/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["@antv/g2", "@antv/s2", "ag-grid-react"],
  },
  webpack: (config) => {
    // pdfjs-dist's build has an optional `canvas` require for Node-side
    // rendering that the browser-only Viewer never uses. Stub it so the
    // bundler doesn't fail trying to resolve the native module.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
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
