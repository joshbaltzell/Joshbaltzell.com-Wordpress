/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@slack/bolt", "bullmq", "ioredis", "pg"],
  },
};

module.exports = nextConfig;
