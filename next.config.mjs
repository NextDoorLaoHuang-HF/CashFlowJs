/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      timeout: 30
    }
  }
};

export default nextConfig;
