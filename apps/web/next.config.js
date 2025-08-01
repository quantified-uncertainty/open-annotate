/** @type {import('next').NextConfig} */

// Conditionally load PrismaPlugin only if not in Docker build
let PrismaPlugin;
if (process.env.DOCKER_BUILD !== 'true') {
  try {
    PrismaPlugin = require('@prisma/nextjs-monorepo-workaround-plugin').PrismaPlugin;
  } catch (e) {
    console.warn('PrismaPlugin not available, skipping');
  }
}

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["react-markdown", "rehype-raw", "remark-gfm"],
  // Monorepo file tracing (moved from experimental in Next.js 15)
  outputFileTracingRoot: require('path').join(__dirname, '../../'),
  // Explicitly include Prisma engines in serverless bundle (Next.js 15 renamed from serverComponentsExternalPackages)
  serverExternalPackages: ['@prisma/client', '@prisma/engines', '@roast/db'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // CRITICAL: Both plugins are needed for Prisma to work in monorepo on Vercel
      
      // 1. Prisma monorepo workaround plugin - handles client resolution (if available)
      if (PrismaPlugin) {
        config.plugins = [...config.plugins, new PrismaPlugin()];
      }
      
      // 2. Explicitly copy Prisma engines - ensures .node binaries are available where Vercel expects them
      //    This is the KEY to making single-client pattern work in monorepo deployments
      const path = require('path');
      
      try {
        const CopyPlugin = require('copy-webpack-plugin');
        config.plugins.push(
          new CopyPlugin({
            patterns: [
              {
                from: path.join(__dirname, '../../internal-packages/db/generated/*.node'),
                to: 'generated/[name][ext]',
                noErrorOnMissing: true,
              },
            ],
          })
        );
      } catch (e) {
        console.warn('CopyPlugin not available, skipping engine copy (Docker build)');
      }
    }

    // Add markdown loader
    config.module.rules.push({
      test: /\.md$/,
      use: "raw-loader",
    });

    if (isServer) {
      // For server-side, externalize native modules
      config.externals = config.externals || [];
      config.externals.push({
        're2': 'commonjs re2',
        'canvas': 'commonjs canvas',
        'sharp': 'commonjs sharp',
      });
    } else {
      // For client-side, completely ignore these modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        're2': false,
        'canvas': false,
        'sharp': false,
        'fs': false,
        'path': false,
        'os': false,
      };
    }
    
    // Ignore native node modules
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });

    return config;
  },
};

module.exports = nextConfig;