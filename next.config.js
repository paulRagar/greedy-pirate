const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
   reactStrictMode: true,
   outputFileTracingRoot: path.join(__dirname),
   images: {
      // 75 = next/image default; 85 = home hero key art
      qualities: [75, 85],
   },
};

module.exports = nextConfig;
