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
    "/api/sports-nfl": {
      target: "https://v1.american-football.api-sports.io",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace(/^\/api\/sports-nfl/, ""),
      headers: {
        ...(nflApiKey ? { "x-apisports-key": nflApiKey } : {}),
      },
    },
    "/api/sports-nba": {
      target: "https://v2.nba.api-sports.io",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => path.replace(/^\/api\/sports-nba/, ""),
      headers: {
        ...(apiSportsKey ? { "x-apisports-key": apiSportsKey } : {}),
      },
    },
    "/api/odds": {
      target: "https://api.the-odds-api.com",
      changeOrigin: true,
      secure: false,
      rewrite: (path: string) => {
        const cleaned = path.replace(/^\/api\/odds/, "");
        if (oddsApiKey) {
          const sep = cleaned.includes("?") ? "&" : "?";
          return `${cleaned}${sep}apiKey=${oddsApiKey}`;
        }
        return cleaned;
      },
      configure: (proxy: any) => {
        proxy.on("proxyRes", (_proxyRes: any, _req: any, res: any) => {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "*");
        });
      },
    },
  };

  return {
    plugins: [react()],
    define: {
      "process.env.API_SPORTS_NBA_KEY": JSON.stringify(""),
      "process.env.API_SPORTS_KEY": JSON.stringify(""),
      "process.env.THE_ODDS_API_KEY": JSON.stringify(""),
      "process.env.API_SPORTS_NFL_KEY": JSON.stringify(""),
      "process.env.GEMINI_API_KEY": JSON.stringify(""),
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      cors: true,
      proxy: proxyConfig,
    },
    preview: {
      host: "0.0.0.0",
      port: 3000,
      cors: true,
      proxy: proxyConfig,
    },
  };
});
