/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Handle audio files
    config.module.rules.push({
      test: /\.(wav|mp3|ogg|glb|gltf)$/,
      type: "asset/resource",
    });
    return config;
  },
  // Enable experimental features if needed
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
