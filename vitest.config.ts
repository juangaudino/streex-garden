import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(viteConfig, defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: resolve("apps/garden-x/src") },
      { find: /^react$/, replacement: resolve("node_modules/react") },
      { find: /^react-dom$/, replacement: resolve("node_modules/react-dom") },
    ],
  },
}));
