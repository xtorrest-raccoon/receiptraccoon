/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rr/shared", "@rr/ui-tokens", "@rr/mock-api"],
  webpack: (config) => {
    // packages/shared uses NodeNext-style relative imports ("./types.js")
    // that point at .ts source files (there is no compiled dist yet). Node's
    // own resolver understands that mapping; webpack needs to be told.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".js", ".ts", ".tsx"],
    };
    return config;
  },
};

export default nextConfig;
