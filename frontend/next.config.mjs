/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pdfjs/pdf-lib are heavy — they are dynamically imported on tool pages only.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async rewrites() {
    return [
      // Proxy API calls to the Laravel backend in local dev.
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
