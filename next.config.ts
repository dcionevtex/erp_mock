import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Old routes moved to /erp/* — handles stale bookmarks and cached callbackUrls
      { source: '/about', destination: '/erp/about', permanent: true },
    ];
  },
};

export default nextConfig;
