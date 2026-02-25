/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle audio files
    config.module.rules.push({
      test: /\.(wav|mp3|ogg|glb|gltf)$/,
      type: "asset/resource",
    });

    // Ensure proper React resolution for React Three Fiber
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        react: require.resolve("react"),
        "react-dom": require.resolve("react-dom"),
      };
    }

    return config;
  },
  // Empty turbopack config to acknowledge Turbopack usage
  turbopack: {},
  // Enable experimental features if needed
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
