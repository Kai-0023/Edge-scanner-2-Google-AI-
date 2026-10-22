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
  - NBA team context: team shooting and possession averages, efficiency & assist-to-turnover ratios, defensive rates, completed-game form (W-L, last 5, point differential), current verified roster, and top player contributors.
  - Scoring Blend Scorecard: transparent baseline home/away projections compared directly with consensus bookmaker totals and spreads to highlight model-to-market gaps.
  - AI Matchup Research Summary: generates concise, grounded explanations from factual displayed context.
- **Home Venue & Weather Context**:
  - Complete 32 NFL stadium and 30 NBA arena reference directory with venue names, cities, and coordinates.
  - Live venue weather powered by Open-Meteo forecasts at official game start times (temperature, precipitation %, wind speed, gusts, and weather conditions with impact review flags).
- **Reviewed Bet Slip Tracker**:
  - Image capture / file upload with client-side OCR for suggested American odds and stake values.
  - User-reviewed entry form for League, Event, Selection, Odds, Stake, and Notes.
  - Local storage persistence for safe, private bet slip review without storing images.

## Technology Stack

- **Frontend**: React 18 / 19, TypeScript, Vite
- **Styling**: Tailored sports research dark-mode design system with responsive layouts
- **Tools & APIs**: Open-Meteo Weather API, U.S. Census Bureau Geocoding API, Tesseract.js OCR, The Odds API connector
