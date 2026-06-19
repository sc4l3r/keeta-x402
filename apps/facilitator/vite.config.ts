import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "web",
  plugins: [preact(), tailwindcss()],
  define: {
    // Some bundled x402/keeta ESM chunks reference `global`
    global: "globalThis",
  },
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/accounts": "http://localhost:4022",
      "/healthz": "http://localhost:4022",
      "/supported": "http://localhost:4022",
      "/verify": "http://localhost:4022",
      "/settle": "http://localhost:4022",
      "/weather": "http://localhost:4022",
      "/faucet": "http://localhost:4022",
    },
  },
});
