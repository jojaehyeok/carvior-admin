/** @type {import('next').NextConfig} */

const nextConfig = {
  basePath: '/admin',
  assetPrefix: 'https://carvior.store/admin', // 정적 파일 경로까지 확실히 지정
  reactStrictMode: true,
  transpilePackages: ["antd"],

};

module.exports = nextConfig;

