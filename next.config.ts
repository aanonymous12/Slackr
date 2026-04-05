import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Disable static generation for pages that use supabase
  },
}

export default nextConfig
