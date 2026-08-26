/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sql.js', 'razorpay'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
