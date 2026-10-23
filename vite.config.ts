import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const name of ["APP_ORIGIN", "TURN_URLS", "TURN_SHARED_SECRET", "TURN_TTL_SECONDS"]) {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  }

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: {
      proxy: {
        "^/admin/": {
          target: `http://127.0.0.1:${process.env.CATCAM_DEV_API_PORT || "3000"}`,
          changeOrigin: false,
        },
        "/ice-servers": {
          target: `http://127.0.0.1:${process.env.CATCAM_DEV_API_PORT || "3000"}`,
          changeOrigin: false,
        },
        "/signal": {
          target: `http://127.0.0.1:${process.env.CATCAM_DEV_API_PORT || "3000"}`,
          changeOrigin: false,
          ws: true,
        },
      },
    },
  };
});
