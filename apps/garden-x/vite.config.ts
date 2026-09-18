// @lovable.dev/vite-tanstack-config owns the approved Lovable plugin stack.
// Only the deployment target changes on Vercel; the frontend remains the Golden Reference.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = Boolean(process.env["VERCEL"]);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: isVercel
    ? {
        preset: "vercel",
        output: {
          dir: ".vercel/output",
          serverDir: ".vercel/output/functions/__server.func",
          publicDir: ".vercel/output/static",
        },
      }
    : true,
});
