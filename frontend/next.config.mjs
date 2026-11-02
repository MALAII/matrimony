/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Rewrite rule or environment configuration for backend API integration
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_INTERNAL_URL || 'http://localhost:5002'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
