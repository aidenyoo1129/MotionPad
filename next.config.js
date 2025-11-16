/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    // Ignore MediaPipe on server side
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@mediapipe/hands': false,
        '@mediapipe/camera_utils': false,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig


