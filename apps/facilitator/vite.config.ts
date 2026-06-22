import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

const FACILITATOR_LOCAL_HOST = "http://localhost:4022";

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
      "/accounts": FACILITATOR_LOCAL_HOST,
      "/healthz": FACILITATOR_LOCAL_HOST,
      "/supported": FACILITATOR_LOCAL_HOST,
      "/verify": FACILITATOR_LOCAL_HOST,
      "/settle": FACILITATOR_LOCAL_HOST,
      "/weather": FACILITATOR_LOCAL_HOST,
      "/faucet": FACILITATOR_LOCAL_HOST,
      "/metrics": FACILITATOR_LOCAL_HOST,
    },
  },
});
