import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiSportsKey = env.API_SPORTS_NBA_KEY || env.API_SPORTS_KEY || process.env.API_SPORTS_NBA_KEY || process.env.API_SPORTS_KEY || "";
  const oddsApiKey = env.THE_ODDS_API_KEY || process.env.THE_ODDS_API_KEY || "";
  const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const nflApiKey = env.API_SPORTS_NFL_KEY || env.API_SPORTS_KEY || process.env.API_SPORTS_NFL_KEY || process.env.API_SPORTS_KEY || "";

  const proxyConfig = {
    "/api/espn": {
      target: "https://site.api.espn.com",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace(/^\/api\/espn/, ""),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    },
  };

  return {
    plugins: [react()],
    define: {
      "process.env.API_SPORTS_NBA_KEY": JSON.stringify(apiSportsKey),
      "process.env.API_SPORTS_KEY": JSON.stringify(apiSportsKey),
      "process.env.THE_ODDS_API_KEY": JSON.stringify(oddsApiKey),
      "process.env.API_SPORTS_NFL_KEY": JSON.stringify(nflApiKey),
      "process.env.GEMINI_API_KEY": JSON.stringify(geminiApiKey),
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      proxy: proxyConfig,
    },
    preview: {
      host: "0.0.0.0",
      port: 3000,
      proxy: proxyConfig,
    },
  };
});
