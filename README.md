# Edge Scanner 2

A modern React and TypeScript application for sports betting line comparisons, NFL/NBA team matchup research, home venue weather intelligence, and reviewed bet slip tracking.

## Core Features

- **Live Line Comparison (Odds & Games)**:
  - Multi-sportsbook comparison (DraftKings, FanDuel, and other US-licensed books) across NBA and NFL.
  - Multi-market odds view: Moneyline (h2h), Point Spreads, and Totals (Over/Under) with live pricing.
  - State Betting Jurisdiction selector covering 50 U.S. states and D.C., with regulatory disclaimers.
  - One-time device location suggestion using the U.S. Census Bureau Geocoder with zero coordinate retention.
- **Team Insights & Matchup Analysis**:
  - Detailed NFL team context: season-to-date quarterback statistics, offensive scoring & yardage, defensive allowances, key-position player availability, and quarterback return-to-action continuity context.
  - Opponent-strength splits: offense performance vs. top/bottom defensive tiers, and defense vs. premier/weaker offenses with delta-from-norm metrics.
  - NBA team context: team shooting and possession averages, efficiency & assist-to-turnover ratios, defensive rates, completed-game form (W-L, last 5, point differential), official ESPN verified roster, and top player contributors.
  - Scoring Blend Scorecard: transparent baseline home/away projections compared directly with consensus bookmaker totals and spreads to highlight model-to-market gaps.
  - Matchup Research Summary: generates concise, grounded explanations from factual displayed context.
- **Home Venue & Weather Context**:
  - Complete 32 NFL stadium and 30 NBA arena reference directory with venue names, cities, and coordinates.
  - Live venue weather powered by Open-Meteo forecasts at official game start times (temperature, precipitation %, wind speed, gusts, and weather conditions with impact review flags).
- **Reviewed Bet Slip Tracker**:
  - Dual capture controls: environment-facing rear camera capture or photo-library file upload.
  - Client-side OCR (Tesseract.js) suggesting American odds and stake values with full manual editing.
  - Local browser storage persistence for safe, private bet slip review without uploading or saving slip images.

---

## Mobile Phone Guide & Device Permissions

This application is optimized for mobile browsers and touch devices. It adheres to strict, user-initiated permission boundaries:

### 1. Location Permission
- **When it appears**: The browser will **never** ask for your location on page load. A permission prompt is only triggered if you deliberately tap the **📍 Detect state** button in the Odds & Games tab.
- **Why it is used**: If granted, your approximate coordinates are submitted for a one-time lookup against the public U.S. Census Bureau Geocoder to automatically suggest your current U.S. state betting jurisdiction. No coordinates or location history are ever saved, tracked, or sent to analytics.
- **Manual Fallback**: If you decline location access, if your browser does not support geolocation, or if you prefer privacy, you can simply choose your state directly from the **Betting jurisdiction** dropdown menu.

### 2. Camera & Photo Library Access
- **When it appears**: In the **Slip Tracker** utility, two distinct options are provided:
  - **📷 Back Camera**: Formatted with `accept="image/*"` and `capture="environment"`. On supported mobile browsers (iOS Safari, Android Chrome), tapping this directly launches your device's rear camera so you can snap a photo of a physical printed ticket or sportsbook slip.
  - **📁 Photo Library / Files**: Formatted with `accept="image/*"` without device capture. Tapping this opens your phone's photo library, screenshot gallery, or file picker.
- **Camera Fallback & Notices**: If your device or browser cannot offer a camera (e.g., desktop computers without webcams or restricted browser webviews), the app displays a clear notification advising you to use the **Photo Library / Files** button instead.
- **Privacy Guarantee**: Slip image processing and optical character recognition (OCR) run entirely client-side inside your browser engine. Slip images are never uploaded to remote servers, and raw images are discarded once reviewed.

### 3. Microphone (Audio)
- **Zero Audio Usage**: This application contains no voice, recording, or audio features. The app **never** requests microphone permission, and no audio recording APIs exist in the codebase.

---

## Configuration & Environment Variables

To protect credentials from exposure in client-side browser bundles, provider calls are routed through server-side proxy routes. The client bundle never includes secret keys.

When running or deploying outside AI Studio, define the following environment variables in your server or hosting environment:

| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `API_SPORTS_NFL_KEY` | Optional | API-Sports American Football API key for live NFL game logs, scoring, and player passing records. |
| `API_SPORTS_NBA_KEY` | Optional | API-Sports Basketball API key for live NBA team statistics, standings, and game logs. |
| `API_SPORTS_KEY` | Optional | Fallback unified API-Sports key if separate sport-specific keys are not set. |
| `THE_ODDS_API_KEY` | Optional | The Odds API key for live US sportsbook odds comparisons across NBA and NFL. |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for server-side AI assistance. |

*Note: In development and preview within AI Studio, these requests are proxied via Vite development server proxies (`/api/sports-nfl`, `/api/sports-nba`, `/api/odds`, `/api/espn`) with server-side header injection. When deploying to production on public platforms (Vercel, Netlify, Cloud Run, AWS), do not expose keys in client-side Vite definitions (`define` / `VITE_*`); configure serverless functions or an API gateway to proxy provider requests securely.*

---

## Deployment Considerations & Limitations

1. **Server-Side Proxy Required for Public Deployment**:
   - In production outside AI Studio, provider APIs (The Odds API, API-Sports) require API keys and enforce CORS restrictions. Ensure your production host runs a server route, reverse proxy (e.g., Nginx, Express), or edge function to append keys on the server side without exposing them in client bundles.
2. **CORS & Public Endpoints**:
   - Official NBA roster membership is retrieved via ESPN's public endpoint (`/api/espn/apis/site/v2/sports/basketball/nba/teams/{team}/roster`), which requires a proxy on some mobile browsers due to CORS headers.
3. **HTTPS / Secure Context for Camera & Geolocation**:
   - Modern mobile operating systems (iOS and Android) only allow browser camera capture and geolocation in secure contexts (`https://` or `localhost`). When hosting for mobile users, an active SSL/TLS certificate is mandatory for device permissions to function.
