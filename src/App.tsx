import React, { useState, useEffect, useRef } from "react";
import { US_STATES, lookupDeviceJurisdiction } from "./logic/jurisdiction";
import {
  listVenues,
  homeVenue,
  VenueInfo,
} from "./logic/venueRegistry";
import { fetchGameWeather, GameWeather } from "./logic/weather";
import {
  fetchLiveOdds,
  fetchNflInsights,
  fetchNbaInsights,
  marketComparison,
  seasonForGame,
  generateAiSummary,
  validateAll32NflTeamsOpponentStrength,
  Nfl32TeamAuditReport,
  NFL_32_TEAMS,
  OddsEvent,
  GameInsightPayload,
  NflTeamInsightData,
  NbaTeamInsightData,
} from "./logic/oddsAndInsights";
import {
  getTrackingEntries,
  saveTrackingEntry,
  TrackingEntry,
} from "./logic/storage";
import { extractBetSlipFromImage } from "./logic/slipOcr";

export function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"odds" | "insights">("odds");

  // Odds Controls
  const [league, setLeague] = useState<"nba" | "nfl">("nba");
  const [bookmakersInput, setBookmakersInput] = useState("draftkings,fanduel");
  const [jurisdiction, setJurisdiction] = useState("");
  const [jurisdictionSource, setJurisdictionSource] = useState<"manual" | "device">("manual");
  const [deviceLocationStatus, setDeviceLocationStatus] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Odds Data & State
  const [isLoadingOdds, setIsLoadingOdds] = useState(false);
  const [oddsStatus, setOddsStatus] = useState<{ text: string; isError?: boolean }>({
    text: "Ready to load odds.",
  });
  const [summaryData, setSummaryData] = useState<{
    eventCount: number;
    requestsRemaining: string | number;
    markets: string[];
    source: string;
    refreshedAt: string;
    league: "nba" | "nfl";
  } | null>(null);
  const [events, setEvents] = useState<OddsEvent[]>([]);
  const [displayedSportsbooks, setDisplayedSportsbooks] = useState<string[]>([]);

  // Venue Context State
  const [venueLeague, setVenueLeague] = useState<"nba" | "nfl">("nba");
  const [venueTeams, setVenueTeams] = useState<VenueInfo[]>([]);
  const [selectedHomeTeam, setSelectedHomeTeam] = useState("");
  const [selectedUpcomingGameKey, setSelectedUpcomingGameKey] = useState("");
  const [venueGameTime, setVenueGameTime] = useState("");
  const [venueStatus, setVenueStatus] = useState<{ text: string; isError?: boolean }>({
    text: "Loading NBA home venues…",
  });
  const [venueResult, setVenueResult] = useState<{
    homeTeam: string;
    venueName: string;
    city: string;
    scheduledGameLine?: string;
    weather?: GameWeather;
    weatherUnavailable?: string;
  } | null>(null);
  const venueFormRef = useRef<HTMLFormElement>(null);

  // Slip Tracker State
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ text: string; isError?: boolean }>({
    text: "OCR is optional—manual entry also works.",
  });
  const [trackingLeague, setTrackingLeague] = useState<"nba" | "nfl" | "other">("other");
  const [trackingEvent, setTrackingEvent] = useState("");
  const [trackingSelection, setTrackingSelection] = useState("");
  const [trackingOdds, setTrackingOdds] = useState("");
  const [trackingStake, setTrackingStake] = useState("");
  const [trackingNotes, setTrackingNotes] = useState("");
  const [trackingSource, setTrackingSource] = useState<"manual" | "ocr_confirmed">("manual");
  const [trackingStatus, setTrackingStatus] = useState<{ text: string; isError?: boolean } | null>(null);
  const [trackingEntries, setTrackingEntries] = useState<TrackingEntry[]>([]);

  // Insights State
  const [selectedInsightGame, setSelectedInsightGame] = useState<OddsEvent | null>(null);
  const [insightStatus, setInsightStatus] = useState<{ text: string; isError?: boolean }>({
    text: "Load NFL or NBA odds, then choose a game to analyze.",
  });
  const [analysisSubTab, setAnalysisSubTab] = useState<number>(0);
  const [nflInsightData, setNflInsightData] = useState<GameInsightPayload<NflTeamInsightData> | null>(null);
  const [nbaInsightData, setNbaInsightData] = useState<GameInsightPayload<NbaTeamInsightData> | null>(null);

  // AI Summary State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSummaryStatus, setAiSummaryStatus] = useState<{ text: string; isError?: boolean } | null>(null);
  const [aiSummaryResult, setAiSummaryResult] = useState<{ analysis: string; disclaimer: string; source: string } | null>(null);

  // 32-Team Audit State
  const [nfl32AuditReport, setNfl32AuditReport] = useState<Nfl32TeamAuditReport | null>(null);
  const [isRunning32Audit, setIsRunning32Audit] = useState(false);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditStatus, setAuditStatus] = useState<string | null>(null);

  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    loadVenueTeamsList("nba");
    setTrackingEntries(getTrackingEntries());
    handleLoadOdds("nba", "draftkings,fanduel");

    // Check camera availability for mobile capture
    if (typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const hasVideo = devices.some((d) => d.kind === "videoinput");
          if (!hasVideo && devices.length > 0) {
            setCameraNotice("No camera was detected on this device. Use photo library upload instead.");
          }
        })
        .catch(() => {});
    } else if (typeof navigator !== "undefined" && !("mediaDevices" in navigator)) {
      setCameraNotice("Camera capture is not supported in this browser context. Use photo library upload instead.");
    }
  }, []);

  function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    if (file) {
      setSelectedImageFile(file);
      setSelectedImageUrl(URL.createObjectURL(file));
      setTrackingSource("manual");
      setScanStatus({
        text: `Image selected (${file.name || "slip"}). You can read it with OCR or enter the fields yourself.`,
      });
    } else {
      setSelectedImageFile(null);
      setSelectedImageUrl(null);
    }
    e.target.value = "";
  }

  function readableSportsbooks() {
    const configured = bookmakersInput
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => name.replace(/_/g, " "));
    const names = displayedSportsbooks.length ? displayedSportsbooks : configured;
    return names.length ? names.join(", ") : "the selected sportsbook providers";
  }

  function jurisdictionMessage() {
    const books = readableSportsbooks();
    const selectedObj = US_STATES.find((s) => s.code === jurisdiction);
    if (!jurisdiction) {
      return `Research view only. Choose a U.S. state or D.C., or use device location to suggest one, before treating lines from ${books} as actionable.`;
    }
    const source = jurisdictionSource === "device" ? "was suggested from device location" : "selected";
    return `${selectedObj?.name || jurisdiction} ${source}. Lines shown from ${books} are research context—not proof that a provider is licensed or available there. Confirm each book's current eligibility, age rules, and account requirements before placing any wager.`;
  }

  // Device Location - Only requested upon explicit user click on Detect state button
  function handleUseDeviceLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDeviceLocationStatus({
        text: "Location detection is unsupported by this browser or connection. Choose your state manually from the list below.",
        isError: true,
      });
      return;
    }
    setIsLocating(true);
    setDeviceLocationStatus({
      text: "Requesting browser permission for a one-time state suggestion…",
    });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const state = await lookupDeviceJurisdiction(
            Number(pos.coords.latitude.toFixed(3)),
            Number(pos.coords.longitude.toFixed(3))
          );
          setJurisdiction(state.code);
          setJurisdictionSource("device");
          setDeviceLocationStatus({
            text: `${state.name} was suggested from your device location. You can still choose a different state manually.`,
          });
        } catch (err: any) {
          setDeviceLocationStatus({
            text: err.message || "Unable to determine your state from coordinates. Choose your state manually from the list below.",
            isError: true,
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        let msg = "Device location could not be determined. Choose your state manually from the list below.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission was denied. You can choose any state manually from the dropdown selector below.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Device location is currently unavailable. Choose your state manually from the list below.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Device location request timed out. Try again or choose your state manually from the list below.";
        }
        setDeviceLocationStatus({ text: msg, isError: true });
        setIsLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 }
    );
  }

  // Venue Teams
  function loadVenueTeamsList(lg: "nba" | "nfl", preferredTeam = "") {
    try {
      const venues = listVenues(lg);
      setVenueTeams(venues);
      if (preferredTeam && venues.some((v) => v.team === preferredTeam)) {
        setSelectedHomeTeam(preferredTeam);
      } else if (venues.length) {
        setSelectedHomeTeam(venues[0].team);
      }
      setVenueStatus({ text: "Select a home team to use its official home venue." });
    } catch (err: any) {
      setVenueStatus({ text: err.message, isError: true });
    }
  }

  // Load Odds
  async function handleLoadOdds(selectedLg = league, books = bookmakersInput) {
    setIsLoadingOdds(true);
    setOddsStatus({ text: `Requesting live ${selectedLg.toUpperCase()} lines from The Odds API…` });

    try {
      const data = await fetchLiveOdds(selectedLg, books.trim(), (progressMsg) => {
        setOddsStatus({ text: progressMsg, isError: false });
      });

      setSummaryData({
        eventCount: data.event_count,
        requestsRemaining: data.usage.requests_remaining ?? "—",
        markets: data.markets,
        source: data.source,
        refreshedAt: data.last_refreshed_at || new Date().toLocaleTimeString(),
        league: selectedLg,
      });

      const booksSeen = Array.from(
        new Set(
          data.events.flatMap((e) => (e.bookmakers || []).map((b) => b.title)).filter(Boolean)
        )
      );
      setDisplayedSportsbooks(booksSeen);
      setEvents(data.events);

      if (data.quota_exhausted) {
        setOddsStatus({
          text: data.status_message || "The Odds API monthly credit quota has been reached (0 of 500 requests remaining).",
          isError: true,
        });
      } else if (data.fetch_error) {
        setOddsStatus({
          text: data.status_message || `Live lines temporarily unavailable (${data.fetch_error}). Tap "Refresh lines" to retry.`,
          isError: true,
        });
      } else if (data.event_count === 0) {
        setOddsStatus({
          text: "No live events are currently available from the selected sportsbooks.",
          isError: false,
        });
      } else {
        setOddsStatus({
          text: data.status_message || `Live lines loaded from ${data.source} (${data.event_count} events).`,
          isError: false,
        });
      }
    } catch (err: any) {
      setOddsStatus({
        text: `Could not load odds: ${err.message}`,
        isError: true,
      });
      setEvents([]);
    } finally {
      setIsLoadingOdds(false);
    }
  }

  // Venue Context Resolution
  async function handleShowVenueContext(
    customHomeTeam?: string,
    customLeague?: "nba" | "nfl",
    customGameTime?: string,
    matchedGame?: OddsEvent | null
  ) {
    const targetTeam = customHomeTeam || selectedHomeTeam;
    const targetLeague = customLeague || venueLeague;
    const targetTime = customGameTime !== undefined ? customGameTime : venueGameTime;

    if (!targetTeam) {
      setVenueStatus({ text: "Choose a home team first.", isError: true });
      return;
    }

    setVenueStatus({ text: `Resolving ${targetTeam}'s home venue…` });
    try {
      const venue = homeVenue(targetLeague, targetTeam);
      let scheduledLine: string | undefined;

      if (matchedGame) {
        scheduledLine = `Scheduled game: ${matchedGame.away_team} at ${matchedGame.home_team} — ${new Date(
          matchedGame.commence_time
        ).toLocaleString()}`;
      } else if (targetTime) {
        scheduledLine = `Game time selected for venue context: ${new Date(targetTime).toLocaleString()}`;
      }

      let weather: GameWeather | undefined;
      let weatherUnavailable: string | undefined;

      if (targetLeague === "nfl" && targetTime) {
        try {
          weather = await fetchGameWeather(venue.latitude, venue.longitude, targetTime);
        } catch (weaErr: any) {
          weatherUnavailable = weaErr.message;
        }
      }

      setVenueResult({
        homeTeam: targetTeam,
        venueName: venue.venue,
        city: venue.city,
        scheduledGameLine: scheduledLine,
        weather,
        weatherUnavailable,
      });

      setVenueStatus({
        text:
          weather?.model_note ||
          weatherUnavailable ||
          (matchedGame
            ? `Using the official scheduled date: ${new Date(matchedGame.commence_time).toLocaleString()}.`
            : "No matching upcoming home game is loaded, so no date or weather was guessed."),
      });
    } catch (err: any) {
      setVenueStatus({ text: err.message, isError: true });
      setVenueResult(null);
    }
  }

  // OCR Slip Scanning
  async function handleScanSlip() {
    if (!selectedImageFile) {
      setScanStatus({
        text: "Choose a slip image first, or enter the fields manually.",
        isError: true,
      });
      return;
    }

    setIsScanningOcr(true);
    setScanStatus({ text: "Reading image with OCR…" });

    try {
      const res = await extractBetSlipFromImage(selectedImageFile);
      if (res.suggestions.american_odds !== null) {
        setTrackingOdds(String(res.suggestions.american_odds));
      }
      if (res.suggestions.stake !== null) {
        setTrackingStake(String(res.suggestions.stake));
      }
      setTrackingSource("ocr_confirmed");
      setScanStatus({
        text: "OCR suggestions were added. Review every field before saving; the image and OCR text will not be stored.",
      });
    } catch (err: any) {
      setTrackingSource("manual");
      setScanStatus({
        text: `${err.message} You can still enter the fields manually.`,
        isError: true,
      });
    } finally {
      setIsScanningOcr(false);
    }
  }

  // Save Bet Tracking
  function handleSaveTracking(e: React.FormEvent) {
    e.preventDefault();
    const oddsNum = trackingOdds.trim() ? Number(trackingOdds) : null;
    const stakeNum = trackingStake.trim() ? Number(trackingStake) : null;

    if (
      (oddsNum !== null && !Number.isInteger(oddsNum)) ||
      (stakeNum !== null && Number.isNaN(stakeNum))
    ) {
      setTrackingStatus({
        text: "Enter whole-number American odds and a valid stake, or leave them blank.",
        isError: true,
      });
      return;
    }

    saveTrackingEntry({
      league: trackingLeague,
      event_name: trackingEvent.trim(),
      selection: trackingSelection.trim(),
      american_odds: oddsNum,
      stake: stakeNum,
      notes: trackingNotes.trim() || null,
      source: trackingSource,
    });

    setTrackingStatus({
      text: "Reviewed entry saved locally. The image and raw OCR text were not saved.",
    });
    setTrackingEvent("");
    setTrackingSelection("");
    setTrackingOdds("");
    setTrackingStake("");
    setTrackingNotes("");
    setTrackingSource("manual");
    setSelectedImageFile(null);
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    setSelectedImageUrl(null);
    setTrackingEntries(getTrackingEntries());
  }

  // Show Team Insights
  async function handleAnalyzeMatchup(game: OddsEvent, forceRefresh = false) {
    setActiveTab("insights");
    setSelectedInsightGame(game);
    setAnalysisSubTab(0);
    setAiSummaryResult(null);
    setAiSummaryStatus(null);
    setInsightStatus({
      text: `Loading authorized ${game.league?.toUpperCase() || league.toUpperCase()} team data…`,
    });

    const season = seasonForGame(game);
    try {
      if (game.league === "nfl" || (!game.league && league === "nfl")) {
        const data = await fetchNflInsights(game.home_team, game.away_team, season, forceRefresh);
        setNflInsightData(data);
        setNbaInsightData(null);
        setInsightStatus({
          text: `Season-to-date ${data.season} context from ${data.source}. Responses are cached for ${data.cache_minutes} minutes to preserve plan usage.`,
        });
      } else {
        const data = await fetchNbaInsights(game.home_team, game.away_team, season, forceRefresh);
        setNbaInsightData(data);
        setNflInsightData(null);
        setInsightStatus({
          text: `Season-to-date ${data.season} context from ${data.source}. Responses are cached for ${data.cache_minutes} minutes to preserve plan usage.`,
        });
      }
    } catch (err: any) {
      setInsightStatus({ text: err.message, isError: true });
    }
  }

  // Generate AI Summary
  async function handleGenerateAiSummary() {
    if (!selectedInsightGame) return;
    const data = nflInsightData || nbaInsightData;
    if (!data) return;

    setIsGeneratingAi(true);
    setAiSummaryStatus({
      text: "Sending the selected matchup's displayed factual context to Google AI Studio…",
    });

    try {
      const currentLg = (selectedInsightGame.league || league) as "nba" | "nfl";
      const result = await generateAiSummary(currentLg, data);
      setAiSummaryResult(result);
      setAiSummaryStatus({
        text: `Generated by ${result.source}.`,
      });
    } catch (err: any) {
      setAiSummaryStatus({ text: err.message, isError: true });
    } finally {
      setIsGeneratingAi(false);
    }
  }

  // Run NFL 32-Team Validation Check
  async function handleRun32Audit(forceRefresh = false) {
    setIsRunning32Audit(true);
    setAuditStatus("Validating all 32 NFL franchises against current-season completed regular-season games…");
    try {
      const activeSeason = (selectedInsightGame && seasonForGame(selectedInsightGame)) || nflInsightData?.season || "2026";
      const report = await validateAll32NflTeamsOpponentStrength(activeSeason, forceRefresh);
      setNfl32AuditReport(report);
      setAuditStatus(
        `Audit complete: ${report.verified_count} of ${report.total_teams} teams verified with active current-season completed schedules (${report.total_regular_season_games} games analyzed).`
      );
    } catch (err: any) {
      setAuditStatus(`Audit error: ${err.message || "Failed to validate teams."}`);
    } finally {
      setIsRunning32Audit(false);
    }
  }

  // Format Helper
  function formatMetric(value: any, suffix = "") {
    const num = Number(value);
    if (value === null || value === undefined || value === "" || Number.isNaN(num)) return "—";
    const rounded = Number.isInteger(num) ? String(num) : num.toFixed(1);
    return `${rounded}${suffix}`;
  }

  function formatSignedMetric(value: any) {
    const formatted = formatMetric(value);
    return formatted !== "—" && Number(value) > 0 ? `+${formatted}` : formatted;
  }

  function hasReportedInjury(availability?: string) {
    const status = String(availability || "").trim().toLowerCase();
    if (!status) return false;
    return ![
      "no current injury report returned",
      "availability data unavailable",
      "available",
      "active",
      "healthy",
    ].includes(status);
  }

  return (
    <main className="page-shell">
      <header>
        <p className="eyebrow">LIVE LINE COMPARISON</p>
        <h1>Edge Scanner</h1>
        <p className="subtitle">
          Compare authorized sportsbook lines without scraping sportsbook websites.
        </p>
        <p className="disclaimer">
          Matchup explanations are transparent baseline calculations, not trained AI predictions or betting advice.
        </p>
      </header>

      {/* Tabs */}
      <nav className="app-tabs" aria-label="Dashboard sections" role="tablist">
        <button
          id="tab-odds"
          className={`tab-button ${activeTab === "odds" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === "odds"}
          onClick={() => setActiveTab("odds")}
        >
          Odds &amp; games
        </button>
        <button
          id="tab-insights"
          className={`tab-button ${activeTab === "insights" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeTab === "insights"}
          onClick={() => setActiveTab("insights")}
        >
          Team insights
        </button>
      </nav>

      {/* Panel 1: Odds & Games */}
      {activeTab === "odds" && (
        <section id="odds-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-odds">
          <section className="controls" aria-label="Odds controls">
            <div className="controls-grid">
              <div className="control-field control-field-league">
                <label htmlFor="league" className="field-label">League</label>
                <select
                  id="league"
                  value={league}
                  onChange={(e) => {
                    const newLg = e.target.value as "nba" | "nfl";
                    setLeague(newLg);
                    setVenueLeague(newLg);
                    loadVenueTeamsList(newLg);
                    handleLoadOdds(newLg, bookmakersInput);
                  }}
                >
                  <option value="nba">NBA</option>
                  <option value="nfl">NFL</option>
                </select>
                <span className="field-hint">Pro basketball or football</span>
              </div>

              <div className="control-field bookmakers-label">
                <label htmlFor="bookmakers" className="field-label">Sportsbooks</label>
                <input
                  id="bookmakers"
                  value={bookmakersInput}
                  onChange={(e) => setBookmakersInput(e.target.value)}
                  aria-describedby="bookmaker-help"
                  placeholder="draftkings,fanduel"
                />
                <span id="bookmaker-help" className="field-hint">Comma-separated provider keys</span>
              </div>

              <div className="control-field jurisdiction-field">
                <div className="jurisdiction-label-row">
                  <label htmlFor="jurisdiction" className="field-label">Betting jurisdiction</label>
                  <button
                    id="use-device-location"
                    className="secondary-button location-detect-btn"
                    type="button"
                    disabled={isLocating}
                    onClick={handleUseDeviceLocation}
                    aria-describedby="device-location-help"
                    title="Auto-detect state using browser location"
                  >
                    {isLocating ? "Detecting…" : "📍 Detect state"}
                  </button>
                </div>
                <select
                  id="jurisdiction"
                  value={jurisdiction}
                  onChange={(e) => {
                    setJurisdiction(e.target.value);
                    setJurisdictionSource("manual");
                  }}
                  aria-describedby="jurisdiction-help"
                >
                  <option value="">Choose a U.S. state or D.C.</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span id="jurisdiction-help" className="field-hint">
                  Choose manually or tap Detect state.
                </span>
              </div>

              <div className="control-field refresh-action-field">
                <button
                  id="refresh"
                  type="button"
                  className="refresh-btn"
                  disabled={isLoadingOdds}
                  onClick={() => handleLoadOdds(league, bookmakersInput)}
                >
                  {isLoadingOdds ? "Loading…" : "Refresh lines"}
                </button>
              </div>
            </div>

            <p id="device-location-help" className="controls-disclaimer">
              Optional location detection asks your browser once, then sends coordinates to the U.S. Census Bureau Geocoder to suggest your state. Edge Scanner never saves coordinates or shares them with sportsbooks.
            </p>
          </section>

          {deviceLocationStatus && (
            <p
              id="device-location-status"
              className={`device-location-status ${deviceLocationStatus.isError ? "error" : ""}`}
              aria-live="polite"
            >
              {deviceLocationStatus.text}
            </p>
          )}

          <section
            id="jurisdiction-status"
            className={`jurisdiction-status ${jurisdiction ? "selected" : ""}`}
            aria-live="polite"
          >
            {jurisdictionMessage()}
          </section>

          <section
            id="status"
            className={`status ${oddsStatus.isError ? "error" : ""}`}
            aria-live="polite"
          >
            {oddsStatus.text}
          </section>

          {summaryData && (
            <section id="summary" className="summary" aria-label="Odds feed summary">
              <span>
                League: <strong>{summaryData.league.toUpperCase()}</strong>
              </span>
              <span>
                <strong>{summaryData.eventCount}</strong> {summaryData.eventCount === 1 ? "event" : "events"} returned
              </span>
              <span>
                Data source: <strong>{summaryData.source}</strong>
              </span>
              <span>
                Last refreshed: <strong>{summaryData.refreshedAt}</strong>
              </span>
              <span>
                API quota: <strong>{summaryData.requestsRemaining}</strong> credits remaining
              </span>
              <span>Markets: {summaryData.markets.join(", ")}</span>
            </section>
          )}

          {/* Events list */}
          <section id="events" className="events" aria-live="polite">
            {events.length === 0 ? (
              <div
                className="empty-events-notice"
                style={{
                  padding: "2.5rem 1.5rem",
                  textAlign: "center",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "10px",
                  border: "1px dashed rgba(255, 255, 255, 0.18)",
                  margin: "1rem 0",
                }}
              >
                <p style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0, color: "var(--text-color, #f0f0f0)" }}>
                  No live events are currently available from the selected sportsbooks.
                </p>
                <p style={{ fontSize: "0.875rem", opacity: 0.8, marginTop: "0.6rem", marginBottom: 0 }}>
                  Selected league: {league.toUpperCase()} · Source: {summaryData?.source || "The Odds API"} · Check back closer to scheduled game times or tap &ldquo;Refresh lines&rdquo; to re-query.
                </p>
              </div>
            ) : (
              events.map((evt) => (
              <article key={evt.id} className="event-card">
                <div className="event-heading">
                  <div>
                    <p className="event-time">{new Date(evt.commence_time).toLocaleString()}</p>
                    <h2>
                      {evt.away_team} <span>at</span> {evt.home_team}
                    </h2>
                  </div>
                  <div className="event-actions">
                    <span className="comparison-count">{evt.bookmakers?.length || 0} books</span>
                    <button
                      className="secondary-button venue-event-button"
                      type="button"
                      onClick={() => {
                        const targetLg = (evt.league || league) as "nba" | "nfl";
                        setVenueLeague(targetLg);
                        loadVenueTeamsList(targetLg, evt.home_team);
                        setSelectedHomeTeam(evt.home_team);
                        setSelectedUpcomingGameKey(`${targetLg}:${evt.id}`);
                        setVenueGameTime("");
                        handleShowVenueContext(evt.home_team, targetLg, evt.commence_time, evt);
                        venueFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      Use home venue
                    </button>
                    <button
                      className="secondary-button insight-event-button"
                      type="button"
                      onClick={() => handleAnalyzeMatchup(evt)}
                    >
                      Analyze matchup
                    </button>
                  </div>
                </div>

                <div className="bookmaker-grid">
                  {evt.bookmakers && evt.bookmakers.length > 0 ? (
                    evt.bookmakers.map((bm) => (
                      <article key={bm.key} className="bookmaker">
                        <div className="bookmaker-title">
                          <h3>{bm.title}</h3>
                          <span>
                            {new Date(bm.last_update).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {bm.markets.map((m) => (
                          <div key={m.key} className="market">
                            <h4>{m.key}</h4>
                            <ul>
                              {m.outcomes.map((o, idx) => {
                                const pt =
                                  o.point !== undefined
                                    ? ` ${o.point > 0 ? "+" : ""}${o.point}`
                                    : "";
                                const pr = o.price > 0 ? `+${o.price}` : String(o.price);
                                return (
                                  <li key={idx}>
                                    <span>
                                      {o.name}
                                      {pt}
                                    </span>
                                    <strong>{pr}</strong>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </article>
                    ))
                  ) : (
                    <p>No selected sportsbook lines are available for this event.</p>
                  )}
                </div>
              </article>
            )))}
          </section>

          {/* Mobile research and tracking tools */}
          <section className="utility-grid" aria-label="Mobile research and tracking tools">
            {/* Venue Card */}
            <article className="utility-card">
              <p className="eyebrow">HOME VENUE CONTEXT</p>
              <h2>Matchup location</h2>
              <p>
                The home team determines the arena or stadium. A selected game, or a loaded upcoming home matchup, supplies the official start date. NFL matchups also include venue weather. Your device location can only suggest a betting jurisdiction; it never changes a matchup venue.
              </p>

              <form
                id="venue-form"
                className="venue-form"
                ref={venueFormRef}
                onSubmit={(e) => {
                  e.preventDefault();
                  const matched = events.find((ev) => ev.home_team === selectedHomeTeam);
                  handleShowVenueContext(
                    selectedHomeTeam,
                    venueLeague,
                    venueGameTime || matched?.commence_time,
                    matched
                  );
                }}
              >
                <label className="full-width">
                  Upcoming game
                  <select
                    id="upcoming-game"
                    value={selectedUpcomingGameKey}
                    onChange={(e) => {
                      const key = e.target.value;
                      setSelectedUpcomingGameKey(key);
                      const matched = events.find((ev) => `${ev.league || league}:${ev.id}` === key);
                      if (matched) {
                        const targetLg = (matched.league || league) as "nba" | "nfl";
                        setVenueLeague(targetLg);
                        loadVenueTeamsList(targetLg, matched.home_team);
                        setSelectedHomeTeam(matched.home_team);
                        setVenueGameTime("");
                        handleShowVenueContext(matched.home_team, targetLg, matched.commence_time, matched);
                      }
                    }}
                    aria-describedby="upcoming-game-help"
                  >
                    <option value="">
                      {events.length
                        ? "Choose an upcoming game from the loaded odds"
                        : "Load authorized live odds to choose a game"}
                    </option>
                    {events.map((ev) => (
                      <option key={ev.id} value={`${ev.league || league}:${ev.id}`}>
                        {new Date(ev.commence_time).toLocaleString()} — {ev.away_team} at {ev.home_team}
                      </option>
                    ))}
                  </select>
                  <span id="upcoming-game-help">
                    Selecting a game fills its league, home team, and official start time.
                  </span>
                </label>

                <label>
                  League
                  <select
                    id="venue-league"
                    value={venueLeague}
                    onChange={(e) => {
                      const newLg = e.target.value as "nba" | "nfl";
                      setVenueLeague(newLg);
                      loadVenueTeamsList(newLg);
                    }}
                  >
                    <option value="nba">NBA</option>
                    <option value="nfl">NFL</option>
                  </select>
                </label>

                <label className="full-width venue-home-label">
                  Home team
                  <select
                    id="venue-home-team"
                    value={selectedHomeTeam}
                    required
                    onChange={(e) => {
                      const team = e.target.value;
                      setSelectedHomeTeam(team);
                      setSelectedUpcomingGameKey("");
                      const matched = events.find((ev) => ev.home_team === team);
                      handleShowVenueContext(team, venueLeague, venueGameTime || matched?.commence_time, matched);
                    }}
                    aria-describedby="venue-help"
                  >
                    {venueTeams.map((v) => (
                      <option key={v.team} value={v.team}>
                        {v.team} — {v.venue}
                      </option>
                    ))}
                  </select>
                  <span id="venue-help">Venue is always resolved from this home team.</span>
                </label>

                <label className="full-width">
                  Venue-local game time (optional; enables NFL weather)
                  <input
                    id="venue-game-time"
                    type="datetime-local"
                    value={venueGameTime}
                    onChange={(e) => {
                      setVenueGameTime(e.target.value);
                      setSelectedUpcomingGameKey("");
                    }}
                  />
                </label>

                <button type="submit">Show home venue</button>
              </form>

              <p
                id="venue-status"
                className={`inline-status ${venueStatus.isError ? "error" : ""}`}
                aria-live="polite"
              >
                {venueStatus.text}
              </p>

              {venueResult && (
                <ul id="venue-result" className="venue-result" aria-live="polite">
                  {venueResult.scheduledGameLine && <li>{venueResult.scheduledGameLine}</li>}
                  <li>{`${venueResult.homeTeam} home venue: ${venueResult.venueName}`}</li>
                  <li>{venueResult.city}</li>
                  {venueResult.weather && (
                    <>
                      <li>
                        {`Weather at ${venueResult.weather.forecast_time_local} (${
                          venueResult.weather.timezone || "venue time"
                        })`}
                      </li>
                      <li>
                        {`${venueResult.weather.conditions.weather_description}; ${venueResult.weather.conditions.temperature_f}°F`}
                      </li>
                      <li>{`Precipitation: ${venueResult.weather.conditions.precipitation_probability_percent}%`}</li>
                      <li>
                        {`Wind: ${venueResult.weather.conditions.wind_speed_mph} mph; gusts ${venueResult.weather.conditions.wind_gusts_mph} mph`}
                      </li>
                      {venueResult.weather.review_flags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </>
                  )}
                  {venueResult.weatherUnavailable && <li>{`Weather: ${venueResult.weatherUnavailable}`}</li>}
                </ul>
              )}
            </article>

            {/* Slip Tracker Card */}
            <article className="utility-card">
              <p className="eyebrow">SLIP TRACKER</p>
              <h2>Capture, review, then save</h2>
              <p>
                Take a photo or choose an image. OCR suggestions are never saved until you check the fields and submit them.
              </p>

              <div className="file-picker-container" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <label className="file-picker" htmlFor="slip-camera" style={{ marginBottom: 0, textAlign: "center" }}>
                    <span style={{ fontWeight: 600 }}>📷 Back Camera</span>
                    <span style={{ fontSize: "0.76rem", color: "#aebbd8" }}>Take photo with rear lens</span>
                    <input
                      id="slip-camera"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageFileSelect}
                      onClick={() => {
                        if (cameraNotice) {
                          setScanStatus({ text: cameraNotice, isError: true });
                        }
                      }}
                    />
                  </label>

                  <label className="file-picker" htmlFor="slip-image" style={{ marginBottom: 0, textAlign: "center" }}>
                    <span style={{ fontWeight: 600 }}>📁 Photo Library / Files</span>
                    <span style={{ fontSize: "0.76rem", color: "#aebbd8" }}>Choose existing photo</span>
                    <input
                      id="slip-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileSelect}
                    />
                  </label>
                </div>

                {cameraNotice && (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#f7b731", background: "rgba(247, 183, 49, 0.1)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(247, 183, 49, 0.25)" }}>
                    {cameraNotice}
                  </p>
                )}
              </div>

              {selectedImageUrl && (
                <img
                  id="slip-preview"
                  className="slip-preview"
                  src={selectedImageUrl}
                  alt="Selected bet slip preview"
                />
              )}

              <button
                id="scan-slip"
                type="button"
                className="secondary-button"
                disabled={isScanningOcr || !selectedImageFile}
                onClick={handleScanSlip}
              >
                {isScanningOcr ? "Reading…" : "Read image with OCR"}
              </button>

              <p
                id="scan-status"
                className={`inline-status ${scanStatus.isError ? "error" : ""}`}
                aria-live="polite"
              >
                {scanStatus.text}
              </p>

              <form id="tracking-form" className="tracking-form" onSubmit={handleSaveTracking}>
                <label>
                  League
                  <select
                    id="tracking-league"
                    value={trackingLeague}
                    onChange={(e) => setTrackingLeague(e.target.value as any)}
                  >
                    <option value="other">Other</option>
                    <option value="nba">NBA</option>
                    <option value="nfl">NFL</option>
                  </select>
                </label>

                <label>
                  Event
                  <input
                    id="tracking-event"
                    required
                    maxLength={140}
                    placeholder="Team A at Team B"
                    value={trackingEvent}
                    onChange={(e) => setTrackingEvent(e.target.value)}
                  />
                </label>

                <label>
                  Selection
                  <input
                    id="tracking-selection"
                    required
                    maxLength={140}
                    placeholder="Selection you reviewed"
                    value={trackingSelection}
                    onChange={(e) => setTrackingSelection(e.target.value)}
                  />
                </label>

                <label>
                  American odds
                  <input
                    id="tracking-odds"
                    inputMode="numeric"
                    placeholder="+125"
                    value={trackingOdds}
                    onChange={(e) => setTrackingOdds(e.target.value)}
                  />
                </label>

                <label>
                  Stake
                  <input
                    id="tracking-stake"
                    inputMode="decimal"
                    placeholder="20.00"
                    value={trackingStake}
                    onChange={(e) => setTrackingStake(e.target.value)}
                  />
                </label>

                <label className="full-width">
                  Notes (optional)
                  <input
                    id="tracking-notes"
                    maxLength={500}
                    placeholder="Your own note"
                    value={trackingNotes}
                    onChange={(e) => setTrackingNotes(e.target.value)}
                  />
                </label>

                <button type="submit">Save reviewed entry</button>
              </form>

              {trackingStatus && (
                <p
                  id="tracking-status"
                  className={`inline-status ${trackingStatus.isError ? "error" : ""}`}
                  aria-live="polite"
                >
                  {trackingStatus.text}
                </p>
              )}

              <ul id="tracking-list" className="tracking-list" aria-live="polite">
                {trackingEntries.map((item) => (
                  <li key={item.id}>
                    {`${item.event_name} — ${item.selection} (${[
                      item.league.toUpperCase(),
                      item.american_odds ? (item.american_odds > 0 ? `+${item.american_odds}` : item.american_odds) : "odds not entered",
                      item.stake !== null ? `$${item.stake}` : "stake not entered",
                    ].join(" · ")})`}
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </section>
      )}

      {/* Panel 2: Team Insights */}
      {activeTab === "insights" && (
        <section id="insights-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-insights">
          <article className="insight-card">
            <p className="eyebrow">TEAM INSIGHTS</p>
            <h2 id="insight-matchup">
              {selectedInsightGame
                ? `${selectedInsightGame.away_team} at ${selectedInsightGame.home_team}`
                : "Choose a matchup"}
            </h2>
            <p>
              Choose <strong>Analyze matchup</strong> on an NFL game for season-to-date quarterback, offense, defense, red-zone, opponent-strength, provider-reported key-player availability, and recent quarterback return-to-action context. NBA analysis includes team averages, notable players, and reported availability. You can optionally generate an AI-written research summary from that same displayed API data. The app compares a simple scoring blend with the current spread or total when available; it never guarantees a bet.
            </p>

            <p
              id="insight-status"
              className={`inline-status ${insightStatus.isError ? "error" : ""}`}
              aria-live="polite"
            >
              {insightStatus.text}
            </p>

            {/* NFL Insights Views */}
            {nflInsightData && (
              <div id="insight-result" className="insight-result" aria-live="polite">
                <section className="analysis-tabs">
                  <div className="analysis-tab-list" role="tablist" aria-label="Matchup analysis sections">
                    {["Overview", "Key availability", "Opponent strength", "Matchup context", "AI summary", "32-team audit"].map(
                      (label, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`analysis-tab-button ${analysisSubTab === idx ? "active" : ""}`}
                          role="tab"
                          aria-selected={analysisSubTab === idx}
                          onClick={() => {
                            setAnalysisSubTab(idx);
                            if (idx === 5 && !nfl32AuditReport) {
                              handleRun32Audit(false);
                            }
                          }}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>

                  <div className="analysis-tab-panels">
                    {/* Sub-tab 0: Overview */}
                    {analysisSubTab === 0 && (
                      <div className="analysis-tab-panel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px", padding: "10px 14px", background: "#10192c", borderRadius: "10px", border: "1px solid #273a5c" }}>
                          <span style={{ fontSize: "0.85rem", color: "#aebbd8" }}>
                            Source: <strong style={{ color: "#72e4bf" }}>{nflInsightData.source || "API-Sports NFL (Live)"}</strong> · Season: <strong style={{ color: "#fff" }}>{nflInsightData.season}</strong> · Last updated: <strong style={{ color: "#fff" }}>{nflInsightData.home.last_updated || "Live"}</strong>
                          </span>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ minHeight: "32px", padding: "0 14px", fontSize: "0.8rem", borderRadius: "6px" }}
                            onClick={() => selectedInsightGame && handleAnalyzeMatchup(selectedInsightGame, true)}
                          >
                            Refresh data
                          </button>
                        </div>

                        <div className="insight-team-grid">
                          {/* Home Team */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Home team</span>
                              <h3>{nflInsightData.home.team}</h3>
                              <span style={{ fontSize: "0.72rem", color: "#72e4bf" }}>
                                {nflInsightData.source || "API-Sports NFL (Live)"} · {nflInsightData.season} · {nflInsightData.home.last_updated}
                              </span>
                            </header>

                            <section className="insight-section quarterback-section">
                              <h4>Quarterback</h4>
                              {nflInsightData.home.quarterback ? (
                                <div className="insight-metrics">
                                  <div className="insight-metric">
                                    <span>Starter by passing yards</span>
                                    <strong>{nflInsightData.home.quarterback.name}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Passing yards</span>
                                    <strong>
                                      {`${formatMetric(nflInsightData.home.quarterback.passing_yards)} · ${formatMetric(
                                        nflInsightData.home.quarterback.passing_yards_per_game,
                                        " / game"
                                      )}`}
                                    </strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Passing TD / INT</span>
                                    <strong>
                                      {`${formatMetric(nflInsightData.home.quarterback.passing_touchdowns)} / ${formatMetric(
                                        nflInsightData.home.quarterback.passing_interceptions
                                      )}`}
                                    </strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rushing yards</span>
                                    <strong>
                                      {`${formatMetric(nflInsightData.home.quarterback.rushing_yards)} · ${formatMetric(
                                        nflInsightData.home.quarterback.rushing_yards_per_game,
                                        " / game"
                                      )}`}
                                    </strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rushing TD</span>
                                    <strong>{formatMetric(nflInsightData.home.quarterback.rushing_touchdowns)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Sacks taken</span>
                                    <strong>{formatMetric(nflInsightData.home.quarterback.sacks_taken)}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="insight-metrics" style={{ gridTemplateColumns: "1fr" }}>
                                  <div className="insight-metric">
                                    <span>Quarterback status</span>
                                    <strong>
                                      {nflInsightData.home.quarterback_unavailable_reason ||
                                        `Quarterback statistics unavailable from API-Sports NFL for season ${nflInsightData.season}.`}
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </section>

                            <section className="insight-section">
                              <h4>Offense</h4>
                              {nflInsightData.home.games > 0 ? (
                                <div className="insight-metrics">
                                  <div className="insight-metric">
                                    <span>Points per game</span>
                                    <strong>{formatMetric(nflInsightData.home.offense.points_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Pass yards per game</span>
                                    <strong>{formatMetric(nflInsightData.home.offense.passing_yards_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rush yards per game</span>
                                    <strong>{formatMetric(nflInsightData.home.offense.rushing_yards_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Sacks allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.home.offense.sacks_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Touchdowns per game</span>
                                    <strong>{formatMetric(nflInsightData.home.offense.touchdowns_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Red-zone TD rate</span>
                                    <strong>{formatMetric(nflInsightData.home.offense.red_zone_touchdown_rate, "%")}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="insight-metrics" style={{ gridTemplateColumns: "1fr" }}>
                                  <div className="insight-metric">
                                    <span>Offense status</span>
                                    <strong>
                                      {nflInsightData.home.reason ||
                                        `Season-to-date offensive statistics unavailable from API-Sports NFL for season ${nflInsightData.season}.`}
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </section>

                            <section className="insight-section">
                              <h4>Defense</h4>
                              {nflInsightData.home.games > 0 ? (
                                <div className="insight-metrics">
                                  <div className="insight-metric">
                                    <span>Points allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.home.defense.points_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Pass yards allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.home.defense.passing_yards_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rush yards allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.home.defense.rushing_yards_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Sacks per game</span>
                                    <strong>{formatMetric(nflInsightData.home.defense.sacks_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Interceptions per game</span>
                                    <strong>{formatMetric(nflInsightData.home.defense.interceptions_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Opp. red-zone TD rate</span>
                                    <strong>{formatMetric(nflInsightData.home.defense.red_zone_touchdown_rate_allowed, "%")}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="insight-metrics" style={{ gridTemplateColumns: "1fr" }}>
                                  <div className="insight-metric">
                                    <span>Defense status</span>
                                    <strong>
                                      {nflInsightData.home.reason ||
                                        `Season-to-date defensive statistics unavailable from API-Sports NFL for season ${nflInsightData.season}.`}
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </section>
                          </article>

                          {/* Away Team */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Away team</span>
                              <h3>{nflInsightData.away.team}</h3>
                              <span style={{ fontSize: "0.72rem", color: "#72e4bf" }}>
                                {nflInsightData.source || "API-Sports NFL (Live)"} · {nflInsightData.season} · {nflInsightData.away.last_updated}
                              </span>
                            </header>

                            <section className="insight-section quarterback-section">
                              <h4>Quarterback</h4>
                              {nflInsightData.away.quarterback ? (
                                <div className="insight-metrics">
                                  <div className="insight-metric">
                                    <span>Starter by passing yards</span>
                                    <strong>{nflInsightData.away.quarterback.name}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Passing yards</span>
                                    <strong>
                                      {`${formatMetric(nflInsightData.away.quarterback?.passing_yards)} · ${formatMetric(
                                        nflInsightData.away.quarterback?.passing_yards_per_game,
                                        " / game"
                                      )}`}
                                    </strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Passing TD / INT</span>
                                    <strong>
                                      {`${formatMetric(nflInsightData.away.quarterback?.passing_touchdowns)} / ${formatMetric(
                                        nflInsightData.away.quarterback?.passing_interceptions
                                      )}`}
                                    </strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rushing yards</span>
                                    <strong>
                                      {`${formatMetric(nflInsightData.away.quarterback?.rushing_yards)} · ${formatMetric(
                                        nflInsightData.away.quarterback?.rushing_yards_per_game,
                                        " / game"
                                      )}`}
                                    </strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rushing TD</span>
                                    <strong>{formatMetric(nflInsightData.away.quarterback?.rushing_touchdowns)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Sacks taken</span>
                                    <strong>{formatMetric(nflInsightData.away.quarterback?.sacks_taken)}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="insight-metrics" style={{ gridTemplateColumns: "1fr" }}>
                                  <div className="insight-metric">
                                    <span>Quarterback status</span>
                                    <strong>
                                      {nflInsightData.away.quarterback_unavailable_reason ||
                                        `Quarterback statistics unavailable from API-Sports NFL for season ${nflInsightData.season}.`}
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </section>

                            <section className="insight-section">
                              <h4>Offense</h4>
                              {nflInsightData.away.games > 0 ? (
                                <div className="insight-metrics">
                                  <div className="insight-metric">
                                    <span>Points per game</span>
                                    <strong>{formatMetric(nflInsightData.away.offense.points_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Pass yards per game</span>
                                    <strong>{formatMetric(nflInsightData.away.offense.passing_yards_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rush yards per game</span>
                                    <strong>{formatMetric(nflInsightData.away.offense.rushing_yards_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Sacks allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.away.offense.sacks_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Touchdowns per game</span>
                                    <strong>{formatMetric(nflInsightData.away.offense.touchdowns_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Red-zone TD rate</span>
                                    <strong>{formatMetric(nflInsightData.away.offense.red_zone_touchdown_rate, "%")}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="insight-metrics" style={{ gridTemplateColumns: "1fr" }}>
                                  <div className="insight-metric">
                                    <span>Offense status</span>
                                    <strong>
                                      {nflInsightData.away.reason ||
                                        `Season-to-date offensive statistics unavailable from API-Sports NFL for season ${nflInsightData.season}.`}
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </section>

                            <section className="insight-section">
                              <h4>Defense</h4>
                              {nflInsightData.away.games > 0 ? (
                                <div className="insight-metrics">
                                  <div className="insight-metric">
                                    <span>Points allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.away.defense.points_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Pass yards allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.away.defense.passing_yards_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Rush yards allowed per game</span>
                                    <strong>{formatMetric(nflInsightData.away.defense.rushing_yards_allowed_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Sacks per game</span>
                                    <strong>{formatMetric(nflInsightData.away.defense.sacks_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Interceptions per game</span>
                                    <strong>{formatMetric(nflInsightData.away.defense.interceptions_per_game)}</strong>
                                  </div>
                                  <div className="insight-metric">
                                    <span>Opp. red-zone TD rate</span>
                                    <strong>{formatMetric(nflInsightData.away.defense.red_zone_touchdown_rate_allowed, "%")}</strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="insight-metrics" style={{ gridTemplateColumns: "1fr" }}>
                                  <div className="insight-metric">
                                    <span>Defense status</span>
                                    <strong>
                                      {nflInsightData.away.reason ||
                                        `Season-to-date defensive statistics unavailable from API-Sports NFL for season ${nflInsightData.season}.`}
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </section>
                          </article>
                        </div>
                      </div>
                    )}

                    {/* Sub-tab 1: Key Availability */}
                    {analysisSubTab === 1 && (
                      <div className="analysis-tab-panel">
                        <div className="insight-team-grid">
                          {/* Home Availability */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Home team</span>
                              <h3>{nflInsightData.home.team}</h3>
                            </header>

                            <section className="insight-section player-section availability-section">
                              <h4>Key availability</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Reading this</span>
                                  <strong>
                                    Provider-reported availability context only. It does not confirm game-day active status or change the scoring blend.
                                  </strong>
                                </div>
                                {nflInsightData.home.availability.players.map((p, idx) => (
                                  <div key={idx} className="insight-metric">
                                    <span>{`${p.position || "Position"} · ${p.name}`}</span>
                                    <strong>{[p.status, p.reason].filter(Boolean).join(" · ")}</strong>
                                  </div>
                                ))}
                              </div>
                            </section>

                            <section className="insight-section player-section quarterback-return-section">
                              <h4>Quarterback return context</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Status</span>
                                  <strong>
                                    {nflInsightData.home.quarterback_return_context.reason ||
                                      "No recent return-to-action pattern was found."}
                                  </strong>
                                </div>
                              </div>
                            </section>
                          </article>

                          {/* Away Availability */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Away team</span>
                              <h3>{nflInsightData.away.team}</h3>
                            </header>

                            <section className="insight-section player-section availability-section">
                              <h4>Key availability</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Reading this</span>
                                  <strong>
                                    Provider-reported availability context only. It does not confirm game-day active status or change the scoring blend.
                                  </strong>
                                </div>
                                {nflInsightData.away.availability.players.map((p, idx) => (
                                  <div key={idx} className="insight-metric">
                                    <span>{`${p.position || "Position"} · ${p.name}`}</span>
                                    <strong>{[p.status, p.reason].filter(Boolean).join(" · ")}</strong>
                                  </div>
                                ))}
                              </div>
                            </section>

                            <section className="insight-section player-section quarterback-return-section">
                              <h4>Quarterback return context</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Status</span>
                                  <strong>
                                    {nflInsightData.away.quarterback_return_context.reason ||
                                      "No recent return-to-action pattern was found."}
                                  </strong>
                                </div>
                              </div>
                            </section>
                          </article>
                        </div>
                      </div>
                    )}

                    {/* Sub-tab 2: Opponent Strength */}
                    {analysisSubTab === 2 && (
                      <div className="analysis-tab-panel">
                        {/* Opponent Strength Metadata Banner */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px", padding: "12px 16px", background: "#10192c", borderRadius: "10px", border: "1px solid #273a5c" }}>
                          <div>
                            <span style={{ fontSize: "0.85rem", color: "#aebbd8", display: "block", marginBottom: "4px" }}>
                              Source: <strong style={{ color: "#72e4bf" }}>{nflInsightData.home.opponent_strength.source || "API-Sports NFL (Live regular season)"}</strong> · Season: <strong style={{ color: "#fff" }}>{nflInsightData.season}</strong> · League Average: <strong style={{ color: "#fff" }}>{nflInsightData.home.opponent_strength.league_average_ppg || 22.9} PPG</strong>
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "#8da2cb" }}>
                              Games analyzed: <strong>{nflInsightData.home.team}</strong> ({nflInsightData.home.opponent_strength.games_used || nflInsightData.home.games} games) · <strong>{nflInsightData.away.team}</strong> ({nflInsightData.away.opponent_strength.games_used || nflInsightData.away.games} games)
                            </span>
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ minHeight: "32px", padding: "0 14px", fontSize: "0.8rem", borderRadius: "6px" }}
                            onClick={() => {
                              setAnalysisSubTab(5);
                              if (!nfl32AuditReport) {
                                handleRun32Audit(false);
                              }
                            }}
                          >
                            🛡️ View 32-team audit
                          </button>
                        </div>

                        <div className="insight-team-grid">
                          {/* Home Opponent Strength */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Home team</span>
                              <h3>{nflInsightData.home.team}</h3>
                              <span style={{ fontSize: "0.75rem", color: "#72e4bf" }}>
                                {nflInsightData.home.opponent_strength.games_used || nflInsightData.home.games} games · {nflInsightData.home.opponent_strength.schedule_difficulty || "balanced"} schedule
                              </span>
                            </header>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Offense against defenses</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Vs stronger defenses</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.offense?.vs_stronger_defenses
                                      ? `${nflInsightData.home.opponent_strength.offense.vs_stronger_defenses.points_per_game} PPG · ${formatSignedMetric(
                                          nflInsightData.home.opponent_strength.offense.vs_stronger_defenses.delta_from_opponent_norm
                                        )} vs opponents' usual allowance · ${nflInsightData.home.opponent_strength.offense.vs_stronger_defenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Vs weaker defenses</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.offense?.vs_weaker_defenses
                                      ? `${nflInsightData.home.opponent_strength.offense.vs_weaker_defenses.points_per_game} PPG · ${formatSignedMetric(
                                          nflInsightData.home.opponent_strength.offense.vs_weaker_defenses.delta_from_opponent_norm
                                        )} vs opponents' usual allowance · ${nflInsightData.home.opponent_strength.offense.vs_weaker_defenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Defense against offenses</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Vs premier offenses</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.defense?.vs_premier_offenses
                                      ? `${nflInsightData.home.opponent_strength.defense.vs_premier_offenses.points_allowed_per_game} allowed · ${formatSignedMetric(
                                          nflInsightData.home.opponent_strength.defense.vs_premier_offenses.delta_from_opponent_norm
                                        )} vs opponents' usual scoring · ${nflInsightData.home.opponent_strength.defense.vs_premier_offenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Vs weaker offenses</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.defense?.vs_weaker_offenses
                                      ? `${nflInsightData.home.opponent_strength.defense.vs_weaker_offenses.points_allowed_per_game} allowed · ${formatSignedMetric(
                                          nflInsightData.home.opponent_strength.defense.vs_weaker_offenses.delta_from_opponent_norm
                                        )} vs opponents' usual scoring · ${nflInsightData.home.opponent_strength.defense.vs_weaker_offenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Opponent-adjusted core metrics</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Scoring resistance</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.metrics_context?.scoring
                                      ? `${formatMetric(nflInsightData.home.opponent_strength.metrics_context.scoring.team_ppg)} PPG · ${formatSignedMetric(nflInsightData.home.opponent_strength.metrics_context.scoring.scoring_delta)} vs opponents' allowance (${formatMetric(nflInsightData.home.opponent_strength.metrics_context.scoring.opponent_avg_points_allowed)} PPG)`
                                      : "Schedule defense verified"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Passing profile</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.metrics_context?.passing?.team_passing_ypg !== null && nflInsightData.home.opponent_strength.metrics_context?.passing?.team_passing_ypg !== undefined
                                      ? `${formatMetric(nflInsightData.home.opponent_strength.metrics_context.passing.team_passing_ypg)} YPG · ${nflInsightData.home.opponent_strength.metrics_context.passing.adjusted_rating}`
                                      : (nflInsightData.home.opponent_strength.metrics_context?.passing?.note || "Passing volume evaluated against schedule defense")}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Rushing front profile</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.metrics_context?.rushing?.team_rushing_ypg !== null && nflInsightData.home.opponent_strength.metrics_context?.rushing?.team_rushing_ypg !== undefined
                                      ? `${formatMetric(nflInsightData.home.opponent_strength.metrics_context.rushing.team_rushing_ypg)} YPG · ${nflInsightData.home.opponent_strength.metrics_context.rushing.adjusted_rating}`
                                      : (nflInsightData.home.opponent_strength.metrics_context?.rushing?.note || "Rushing efficiency benchmarked against opponents")}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Sacks allowed & pressure</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.metrics_context?.sacks?.team_sacks_allowed_pg !== null && nflInsightData.home.opponent_strength.metrics_context?.sacks?.team_sacks_allowed_pg !== undefined
                                      ? `${formatMetric(nflInsightData.home.opponent_strength.metrics_context.sacks.team_sacks_allowed_pg)} allowed/game · ${nflInsightData.home.opponent_strength.metrics_context.sacks.adjusted_rating}`
                                      : "Pass protection context verified"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Red-zone touchdown pace</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.metrics_context?.red_zone?.team_td_per_game !== null && nflInsightData.home.opponent_strength.metrics_context?.red_zone?.team_td_per_game !== undefined
                                      ? `${formatMetric(nflInsightData.home.opponent_strength.metrics_context.red_zone.team_td_per_game)} TD/game · Opponents allow ~${formatMetric(nflInsightData.home.opponent_strength.metrics_context.red_zone.opponent_avg_td_allowed)} TD/game`
                                      : "Touchdown pace evaluated against defensive allowances"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Total-points context</span>
                                  <strong>
                                    {nflInsightData.home.opponent_strength.metrics_context?.total_points_context
                                      ? `Raw: ${formatMetric(nflInsightData.home.opponent_strength.metrics_context.total_points_context.raw_projected_total)} pts · Adj: ${formatMetric(nflInsightData.home.opponent_strength.metrics_context.total_points_context.schedule_adjusted_total)} pts (${formatSignedMetric(nflInsightData.home.opponent_strength.metrics_context.total_points_context.schedule_adjustment_points)} pts schedule delta)`
                                      : "Schedule defense verified"}
                                  </strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Opponents faced ({nflInsightData.home.opponent_strength.games_used || nflInsightData.home.games} games)</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric" style={{ gridColumn: "1 / -1" }}>
                                  <span>Schedule list</span>
                                  <strong>{nflInsightData.home.opponent_strength.opponents_faced?.join(", ") || nflInsightData.home.opponent_strength.method}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Opponents' scoring avg</span>
                                  <strong>{formatMetric(nflInsightData.home.opponent_strength.avg_opponent_offensive_ppg)} PPG</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Opponents' defensive allowance</span>
                                  <strong>{formatMetric(nflInsightData.home.opponent_strength.avg_opponent_defensive_ppg)} PPG allowed</strong>
                                </div>
                              </div>
                            </section>
                          </article>

                          {/* Away Opponent Strength */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Away team</span>
                              <h3>{nflInsightData.away.team}</h3>
                              <span style={{ fontSize: "0.75rem", color: "#72e4bf" }}>
                                {nflInsightData.away.opponent_strength.games_used || nflInsightData.away.games} games · {nflInsightData.away.opponent_strength.schedule_difficulty || "balanced"} schedule
                              </span>
                            </header>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Offense against defenses</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Vs stronger defenses</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.offense?.vs_stronger_defenses
                                      ? `${nflInsightData.away.opponent_strength.offense.vs_stronger_defenses.points_per_game} PPG · ${formatSignedMetric(
                                          nflInsightData.away.opponent_strength.offense.vs_stronger_defenses.delta_from_opponent_norm
                                        )} vs opponents' usual allowance · ${nflInsightData.away.opponent_strength.offense.vs_stronger_defenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Vs weaker defenses</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.offense?.vs_weaker_defenses
                                      ? `${nflInsightData.away.opponent_strength.offense.vs_weaker_defenses.points_per_game} PPG · ${formatSignedMetric(
                                          nflInsightData.away.opponent_strength.offense.vs_weaker_defenses.delta_from_opponent_norm
                                        )} vs opponents' usual allowance · ${nflInsightData.away.opponent_strength.offense.vs_weaker_defenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Defense against offenses</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Vs premier offenses</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.defense?.vs_premier_offenses
                                      ? `${nflInsightData.away.opponent_strength.defense.vs_premier_offenses.points_allowed_per_game} allowed · ${formatSignedMetric(
                                          nflInsightData.away.opponent_strength.defense.vs_premier_offenses.delta_from_opponent_norm
                                        )} vs opponents' usual scoring · ${nflInsightData.away.opponent_strength.defense.vs_premier_offenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Vs weaker offenses</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.defense?.vs_weaker_offenses
                                      ? `${nflInsightData.away.opponent_strength.defense.vs_weaker_offenses.points_allowed_per_game} allowed · ${formatSignedMetric(
                                          nflInsightData.away.opponent_strength.defense.vs_weaker_offenses.delta_from_opponent_norm
                                        )} vs opponents' usual scoring · ${nflInsightData.away.opponent_strength.defense.vs_weaker_offenses.games} games`
                                      : "Not enough completed games"}
                                  </strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Opponent-adjusted core metrics</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Scoring resistance</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.metrics_context?.scoring
                                      ? `${formatMetric(nflInsightData.away.opponent_strength.metrics_context.scoring.team_ppg)} PPG · ${formatSignedMetric(nflInsightData.away.opponent_strength.metrics_context.scoring.scoring_delta)} vs opponents' allowance (${formatMetric(nflInsightData.away.opponent_strength.metrics_context.scoring.opponent_avg_points_allowed)} PPG)`
                                      : "Schedule defense verified"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Passing profile</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.metrics_context?.passing?.team_passing_ypg !== null && nflInsightData.away.opponent_strength.metrics_context?.passing?.team_passing_ypg !== undefined
                                      ? `${formatMetric(nflInsightData.away.opponent_strength.metrics_context.passing.team_passing_ypg)} YPG · ${nflInsightData.away.opponent_strength.metrics_context.passing.adjusted_rating}`
                                      : (nflInsightData.away.opponent_strength.metrics_context?.passing?.note || "Passing volume evaluated against schedule defense")}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Rushing front profile</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.metrics_context?.rushing?.team_rushing_ypg !== null && nflInsightData.away.opponent_strength.metrics_context?.rushing?.team_rushing_ypg !== undefined
                                      ? `${formatMetric(nflInsightData.away.opponent_strength.metrics_context.rushing.team_rushing_ypg)} YPG · ${nflInsightData.away.opponent_strength.metrics_context.rushing.adjusted_rating}`
                                      : (nflInsightData.away.opponent_strength.metrics_context?.rushing?.note || "Rushing efficiency benchmarked against opponents")}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Sacks allowed & pressure</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.metrics_context?.sacks?.team_sacks_allowed_pg !== null && nflInsightData.away.opponent_strength.metrics_context?.sacks?.team_sacks_allowed_pg !== undefined
                                      ? `${formatMetric(nflInsightData.away.opponent_strength.metrics_context.sacks.team_sacks_allowed_pg)} allowed/game · ${nflInsightData.away.opponent_strength.metrics_context.sacks.adjusted_rating}`
                                      : "Pass protection context verified"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Red-zone touchdown pace</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.metrics_context?.red_zone?.team_td_per_game !== null && nflInsightData.away.opponent_strength.metrics_context?.red_zone?.team_td_per_game !== undefined
                                      ? `${formatMetric(nflInsightData.away.opponent_strength.metrics_context.red_zone.team_td_per_game)} TD/game · Opponents allow ~${formatMetric(nflInsightData.away.opponent_strength.metrics_context.red_zone.opponent_avg_td_allowed)} TD/game`
                                      : "Touchdown pace evaluated against defensive allowances"}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Total-points context</span>
                                  <strong>
                                    {nflInsightData.away.opponent_strength.metrics_context?.total_points_context
                                      ? `Raw: ${formatMetric(nflInsightData.away.opponent_strength.metrics_context.total_points_context.raw_projected_total)} pts · Adj: ${formatMetric(nflInsightData.away.opponent_strength.metrics_context.total_points_context.schedule_adjusted_total)} pts (${formatSignedMetric(nflInsightData.away.opponent_strength.metrics_context.total_points_context.schedule_adjustment_points)} pts schedule delta)`
                                      : "Schedule defense verified"}
                                  </strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section opponent-strength-section">
                              <h4>Opponents faced ({nflInsightData.away.opponent_strength.games_used || nflInsightData.away.games} games)</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric" style={{ gridColumn: "1 / -1" }}>
                                  <span>Schedule list</span>
                                  <strong>{nflInsightData.away.opponent_strength.opponents_faced?.join(", ") || nflInsightData.away.opponent_strength.method}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Opponents' scoring avg</span>
                                  <strong>{formatMetric(nflInsightData.away.opponent_strength.avg_opponent_offensive_ppg)} PPG</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Opponents' defensive allowance</span>
                                  <strong>{formatMetric(nflInsightData.away.opponent_strength.avg_opponent_defensive_ppg)} PPG allowed</strong>
                                </div>
                              </div>
                            </section>
                          </article>
                        </div>
                      </div>
                    )}

                    {/* Sub-tab 3: Matchup Context */}
                    {analysisSubTab === 3 && (
                      <div className="analysis-tab-panel">
                        <article className="insight-summary">
                          <h3>Transparent matchup context</h3>
                          <div className="insight-scorecard">
                            <div>
                              <span>Home</span>
                              <strong>{nflInsightData.home.team}</strong>
                              <b>{formatMetric(nflInsightData.matchup_summary.estimated_home_points)}</b>
                            </div>
                            <div className="scorecard-total">
                              <span>Scoring blend</span>
                              <strong>{formatMetric(nflInsightData.matchup_summary.estimated_total)} total</strong>
                              <i>Season-to-date</i>
                            </div>
                            <div>
                              <span>Away</span>
                              <strong>{nflInsightData.away.team}</strong>
                              <b>{formatMetric(nflInsightData.matchup_summary.estimated_away_points)}</b>
                            </div>
                          </div>

                          <p>
                            {`Scoring blend: ${nflInsightData.home.team} ${formatMetric(
                              nflInsightData.matchup_summary.estimated_home_points
                            )} — ${nflInsightData.away.team} ${formatMetric(
                              nflInsightData.matchup_summary.estimated_away_points
                            )}.`}
                          </p>
                          <p>{nflInsightData.matchup_summary.method}</p>
                          {nflInsightData.matchup_summary.opponent_strength_note && (
                            <p className="opponent-strength-summary-note">
                              {nflInsightData.matchup_summary.opponent_strength_note}
                            </p>
                          )}
                          {nflInsightData.matchup_summary.availability_note && (
                            <p className="availability-summary-note">
                              {nflInsightData.matchup_summary.availability_note}
                            </p>
                          )}
                          {selectedInsightGame && (
                            <p>{marketComparison(selectedInsightGame, nflInsightData.matchup_summary)}</p>
                          )}
                          <p className="jurisdiction-insight-note">{jurisdictionMessage()}</p>
                          <p>{nflInsightData.matchup_summary.disclaimer}</p>
                        </article>
                      </div>
                    )}

                    {/* Sub-tab 4: AI Summary */}
                    {analysisSubTab === 4 && (
                      <div className="analysis-tab-panel">
                        <article className="ai-matchup-summary">
                          <h3>AI matchup summary</h3>
                          <p>
                            Create a concise explanation from the API-Sports data already loaded for this game. This does not replace live roster or injury checks and it does not provide a betting instruction.
                          </p>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isGeneratingAi}
                            onClick={handleGenerateAiSummary}
                          >
                            {isGeneratingAi ? "Writing summary…" : "Generate AI summary"}
                          </button>

                          {aiSummaryStatus && (
                            <p
                              className={`ai-summary-status ${aiSummaryStatus.isError ? "error" : ""}`}
                              aria-live="polite"
                            >
                              {aiSummaryStatus.text}
                            </p>
                          )}

                          {aiSummaryResult && (
                            <div className="ai-summary-output">
                              <p className="ai-summary-text">{aiSummaryResult.analysis}</p>
                              <p className="ai-summary-disclaimer">{aiSummaryResult.disclaimer}</p>
                            </div>
                          )}
                        </article>
                      </div>
                    )}

                    {/* Sub-tab 5: 32-Team Audit */}
                    {analysisSubTab === 5 && (
                      <div className="analysis-tab-panel">
                        <article className="insight-summary" style={{ textAlign: "left" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#fff" }}>NFL 32-Team Opponent Strength Validation</h3>
                              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#aebbd8" }}>
                                Validating all 32 NFL franchises using only current-season completed regular-season games from API-Sports NFL.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="refresh-btn"
                              style={{ minHeight: "36px", padding: "0 18px", fontSize: "0.85rem" }}
                              disabled={isRunning32Audit}
                              onClick={() => handleRun32Audit(true)}
                            >
                              {isRunning32Audit ? "Auditing 32 teams…" : "⚡ Run live audit"}
                            </button>
                          </div>

                          {auditStatus && (
                            <p className="inline-status" style={{ marginBottom: "14px", color: nfl32AuditReport?.all_teams_verified ? "#72e4bf" : "#ffd166" }}>
                              {auditStatus}
                            </p>
                          )}

                          {nfl32AuditReport ? (
                            <div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "18px" }}>
                                <div style={{ background: "#0c1424", padding: "12px", borderRadius: "8px", border: "1px solid #1e2c4a" }}>
                                  <span style={{ fontSize: "0.75rem", color: "#8da2cb", textTransform: "uppercase" }}>Coverage</span>
                                  <strong style={{ display: "block", fontSize: "1.25rem", color: "#72e4bf" }}>
                                    {nfl32AuditReport.verified_count} / {nfl32AuditReport.total_teams} Verified
                                  </strong>
                                </div>
                                <div style={{ background: "#0c1424", padding: "12px", borderRadius: "8px", border: "1px solid #1e2c4a" }}>
                                  <span style={{ fontSize: "0.75rem", color: "#8da2cb", textTransform: "uppercase" }}>Missing / Fallback</span>
                                  <strong style={{ display: "block", fontSize: "1.25rem", color: nfl32AuditReport.missing_or_failed_count === 0 ? "#72e4bf" : "#ff6b6b" }}>
                                    {nfl32AuditReport.missing_or_failed_count} teams
                                  </strong>
                                </div>
                                <div style={{ background: "#0c1424", padding: "12px", borderRadius: "8px", border: "1px solid #1e2c4a" }}>
                                  <span style={{ fontSize: "0.75rem", color: "#8da2cb", textTransform: "uppercase" }}>League Average</span>
                                  <strong style={{ display: "block", fontSize: "1.25rem", color: "#fff" }}>
                                    {nfl32AuditReport.league_average_ppg} PPG
                                  </strong>
                                </div>
                                <div style={{ background: "#0c1424", padding: "12px", borderRadius: "8px", border: "1px solid #1e2c4a" }}>
                                  <span style={{ fontSize: "0.75rem", color: "#8da2cb", textTransform: "uppercase" }}>Regular Season Games</span>
                                  <strong style={{ display: "block", fontSize: "1.25rem", color: "#fff" }}>
                                    {nfl32AuditReport.total_regular_season_games} completed
                                  </strong>
                                </div>
                              </div>

                              <div style={{ marginBottom: "14px" }}>
                                <input
                                  type="text"
                                  placeholder="Filter by team name or abbreviation (e.g. Bears, KC, Eagles)…"
                                  value={auditFilter}
                                  onChange={(e) => setAuditFilter(e.target.value)}
                                  style={{ width: "100%", padding: "8px 12px", background: "#0e172a", border: "1px solid #273a5c", borderRadius: "6px", color: "#fff" }}
                                />
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                                {nfl32AuditReport.teams
                                  .filter((t) => {
                                    if (!auditFilter.trim()) return true;
                                    const q = auditFilter.toLowerCase().trim();
                                    return t.team.toLowerCase().includes(q) || t.abbr.toLowerCase().includes(q);
                                  })
                                  .map((t) => (
                                    <div
                                      key={t.id}
                                      style={{
                                        background: "#10192c",
                                        border: "1px solid #273a5c",
                                        borderRadius: "8px",
                                        padding: "12px",
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                        <strong style={{ color: "#fff", fontSize: "0.95rem" }}>
                                          {t.team} <span style={{ color: "#72e4bf", fontSize: "0.8rem" }}>({t.abbr})</span>
                                        </strong>
                                        <span
                                          style={{
                                            fontSize: "0.72rem",
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            background: t.status === "verified" ? "rgba(114, 228, 191, 0.15)" : "rgba(255, 107, 107, 0.15)",
                                            color: t.status === "verified" ? "#72e4bf" : "#ff6b6b",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {t.status === "verified" ? "✓ Verified" : t.status}
                                        </span>
                                      </div>

                                      <div style={{ fontSize: "0.8rem", color: "#aebbd8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
                                        <div>Games: <strong style={{ color: "#fff" }}>{t.games_completed}</strong> {t.games_completed < 6 ? <span style={{ fontSize: "0.7rem", color: "#ffd166" }}>(Bye/Schedule)</span> : null}</div>
                                        <div>Schedule: <strong style={{ color: "#fff", textTransform: "capitalize" }}>{t.schedule_difficulty}</strong></div>
                                        <div>Team PPG: <strong style={{ color: "#fff" }}>{t.ppg}</strong></div>
                                        <div>Def Allowed: <strong style={{ color: "#fff" }}>{t.opp_ppg}</strong></div>
                                        <div>Opp Offense: <strong style={{ color: "#fff" }}>{t.avg_opponent_ppg} PPG</strong></div>
                                        <div>Opp Defense: <strong style={{ color: "#fff" }}>{t.avg_opponent_defensive_ppg} PPG</strong></div>
                                      </div>

                                      <div style={{ fontSize: "0.72rem", color: "#8da2cb", borderTop: "1px solid #1e2c4a", paddingTop: "6px" }}>
                                        Opponents ({t.opponents_faced.length}): {t.opponents_faced.join(", ")}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: "24px", textAlign: "center", background: "#0c1424", borderRadius: "8px", border: "1px dashed #273a5c" }}>
                              <p style={{ color: "#aebbd8", marginBottom: "12px" }}>
                                Click below to run a validation check across all 32 NFL franchises and verify their completed regular-season schedule data.
                              </p>
                              <button
                                type="button"
                                className="refresh-btn"
                                disabled={isRunning32Audit}
                                onClick={() => handleRun32Audit(false)}
                              >
                                {isRunning32Audit ? "Auditing 32 teams…" : "🛡️ Verify all 32 NFL teams"}
                              </button>
                            </div>
                          )}
                        </article>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* NBA Insights Views */}
            {nbaInsightData && (
              <div id="insight-result" className="insight-result" aria-live="polite">
                <section className="analysis-tabs">
                  <div className="analysis-tab-list" role="tablist" aria-label="Matchup analysis sections">
                    {["Overview", "Players", "Matchup context", "AI summary"].map((label, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`analysis-tab-button ${analysisSubTab === idx ? "active" : ""}`}
                        role="tab"
                        aria-selected={analysisSubTab === idx}
                        onClick={() => setAnalysisSubTab(idx)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="analysis-tab-panels">
                    {/* Sub-tab 0: Overview */}
                    {analysisSubTab === 0 && (
                      <div className="analysis-tab-panel">
                        <div className="insight-team-grid">
                          {/* Home Team */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Home team</span>
                              <h3>{nbaInsightData.home.team}</h3>
                            </header>

                            <section className="insight-section">
                              <h4>Team averages</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Games</span>
                                  <strong>{formatMetric(nbaInsightData.home.games)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Points per game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.points_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Field-goal percentage</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.field_goal_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Three-point percentage</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.three_point_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Rebounds per game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.rebounds_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Assists per game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.assists_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Turnovers per game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.turnovers_per_game)}</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section">
                              <h4>Efficiency &amp; possession</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Free-throw percentage</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.free_throw_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Free-throw attempts / game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.free_throw_attempts_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Three-point attempts / game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.three_point_attempts_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Assist / turnover</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.assist_to_turnover_ratio)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Offensive rebounds / game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.offensive_rebounds_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Defensive rebounds / game</span>
                                  <strong>{formatMetric(nbaInsightData.home.offense.defensive_rebounds_per_game)}</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section">
                              <h4>Defense</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Points allowed per game</span>
                                  <strong>{formatMetric(nbaInsightData.home.defense.points_allowed_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Steals per game</span>
                                  <strong>{formatMetric(nbaInsightData.home.defense.steals_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Blocks per game</span>
                                  <strong>{formatMetric(nbaInsightData.home.defense.blocks_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Opponent field-goal percentage</span>
                                  <strong>{formatMetric(nbaInsightData.home.defense.opponent_field_goal_percentage, "%")}</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section">
                              <h4>Completed-game form</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Record</span>
                                  <strong>{`${nbaInsightData.home.form.wins}-${nbaInsightData.home.form.losses}`}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Win percentage</span>
                                  <strong>{formatMetric(nbaInsightData.home.form.win_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Last five</span>
                                  <strong>{nbaInsightData.home.form.recent_form.join(" · ")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Point differential / game</span>
                                  <strong>{formatSignedMetric(nbaInsightData.home.form.point_differential_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Recent points / allowed</span>
                                  <strong>{`${formatMetric(nbaInsightData.home.form.recent_points_per_game)} / ${formatMetric(
                                    nbaInsightData.home.form.recent_points_allowed_per_game
                                  )}`}</strong>
                                </div>
                              </div>
                            </section>
                          </article>

                          {/* Away Team */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Away team</span>
                              <h3>{nbaInsightData.away.team}</h3>
                            </header>

                            <section className="insight-section">
                              <h4>Team averages</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Games</span>
                                  <strong>{formatMetric(nbaInsightData.away.games)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Points per game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.points_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Field-goal percentage</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.field_goal_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Three-point percentage</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.three_point_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Rebounds per game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.rebounds_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Assists per game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.assists_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Turnovers per game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.turnovers_per_game)}</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section">
                              <h4>Efficiency &amp; possession</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Free-throw percentage</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.free_throw_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Free-throw attempts / game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.free_throw_attempts_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Three-point attempts / game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.three_point_attempts_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Assist / turnover</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.assist_to_turnover_ratio)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Offensive rebounds / game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.offensive_rebounds_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Defensive rebounds / game</span>
                                  <strong>{formatMetric(nbaInsightData.away.offense.defensive_rebounds_per_game)}</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section">
                              <h4>Defense</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Points allowed per game</span>
                                  <strong>{formatMetric(nbaInsightData.away.defense.points_allowed_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Steals per game</span>
                                  <strong>{formatMetric(nbaInsightData.away.defense.steals_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Blocks per game</span>
                                  <strong>{formatMetric(nbaInsightData.away.defense.blocks_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Opponent field-goal percentage</span>
                                  <strong>{formatMetric(nbaInsightData.away.defense.opponent_field_goal_percentage, "%")}</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section">
                              <h4>Completed-game form</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Record</span>
                                  <strong>{`${nbaInsightData.away.form.wins}-${nbaInsightData.away.form.losses}`}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Win percentage</span>
                                  <strong>{formatMetric(nbaInsightData.away.form.win_percentage, "%")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Last five</span>
                                  <strong>{nbaInsightData.away.form.recent_form.join(" · ")}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Point differential / game</span>
                                  <strong>{formatSignedMetric(nbaInsightData.away.form.point_differential_per_game)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Recent points / allowed</span>
                                  <strong>{`${formatMetric(nbaInsightData.away.form.recent_points_per_game)} / ${formatMetric(
                                    nbaInsightData.away.form.recent_points_allowed_per_game
                                  )}`}</strong>
                                </div>
                              </div>
                            </section>
                          </article>
                        </div>
                      </div>
                    )}

                    {/* Sub-tab 1: Players */}
                    {analysisSubTab === 1 && (
                      <div className="analysis-tab-panel">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px", padding: "10px 14px", background: "#10192c", borderRadius: "10px", border: "1px solid #273a5c" }}>
                          <span style={{ fontSize: "0.85rem", color: "#aebbd8" }}>
                            Source: <strong style={{ color: "#72e4bf" }}>{nbaInsightData.home.roster_source || "ESPN NBA Roster API"}</strong> · Season: <strong style={{ color: "#fff" }}>{nbaInsightData.home.roster_season || nbaInsightData.season}</strong> · Last updated: <strong style={{ color: "#fff" }}>{nbaInsightData.home.roster_last_updated || "Live"}</strong>
                          </span>
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ minHeight: "32px", padding: "0 14px", fontSize: "0.8rem", borderRadius: "6px" }}
                            onClick={() => selectedInsightGame && handleAnalyzeMatchup(selectedInsightGame, true)}
                          >
                            Refresh roster
                          </button>
                        </div>

                        <div className="insight-team-grid">
                          {/* Home Players */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Home team</span>
                              <h3>{nbaInsightData.home.team}</h3>
                              <span style={{ fontSize: "0.72rem", color: "#72e4bf" }}>
                                {nbaInsightData.home.roster_source || "ESPN NBA Roster API"} · {nbaInsightData.home.roster_season} · {nbaInsightData.home.roster_last_updated}
                              </span>
                            </header>

                            <section className="insight-section player-section">
                              <h4>Current roster ({nbaInsightData.home.current_roster?.players?.length || 0})</h4>
                              <div className="insight-metrics">
                                {nbaInsightData.home.current_roster?.players && nbaInsightData.home.current_roster.players.length > 0 ? (
                                  nbaInsightData.home.current_roster.players.map((p, idx) => (
                                    <div key={idx} className="insight-metric">
                                      <span>{p.name}</span>
                                      <strong>{p.position}</strong>
                                    </div>
                                  ))
                                ) : (
                                  <div className="insight-metric">
                                    <span>Status</span>
                                    <strong>
                                      {nbaInsightData.home.current_roster?.reason ||
                                        "Current roster information is unavailable from ESPN NBA Roster API for this team."}
                                    </strong>
                                  </div>
                                )}
                              </div>
                            </section>

                            <section className="insight-section player-section lineup-section">
                              <h4>Starting lineup</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Game-day status</span>
                                  <strong>This data source does not confirm starters. Check the official starting five close to tipoff.</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section">
                              <h4>Top contributors</h4>
                              <div className="insight-metrics">
                                {nbaInsightData.home.notable_players && nbaInsightData.home.notable_players.length > 0 ? (
                                  nbaInsightData.home.notable_players.map((p, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className="insight-metric">
                                        <span>{p.name}</span>
                                        <strong>{`${p.position} · ${formatMetric(p.points_per_game)} PTS · ${formatMetric(
                                          p.rebounds_per_game
                                        )} REB · ${formatMetric(p.assists_per_game)} AST · ${formatMetric(
                                          p.steals_per_game
                                        )} STL · ${formatMetric(p.blocks_per_game)} BLK`}</strong>
                                      </div>
                                      {hasReportedInjury(p.availability) && (
                                        <div className="insight-metric injury-metric">
                                          <span>Reported injury</span>
                                          <strong>{`${p.name}: ${p.availability}`}</strong>
                                        </div>
                                      )}
                                    </React.Fragment>
                                  ))
                                ) : (
                                  <div className="insight-metric">
                                    <span>Status</span>
                                    <strong>No player statistics were returned from API-Sports for this season.</strong>
                                  </div>
                                )}
                              </div>
                            </section>
                          </article>

                          {/* Away Players */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Away team</span>
                              <h3>{nbaInsightData.away.team}</h3>
                              <span style={{ fontSize: "0.72rem", color: "#72e4bf" }}>
                                {nbaInsightData.away.roster_source || "ESPN NBA Roster API"} · {nbaInsightData.away.roster_season} · {nbaInsightData.away.roster_last_updated}
                              </span>
                            </header>

                            <section className="insight-section player-section">
                              <h4>Current roster ({nbaInsightData.away.current_roster?.players?.length || 0})</h4>
                              <div className="insight-metrics">
                                {nbaInsightData.away.current_roster?.players && nbaInsightData.away.current_roster.players.length > 0 ? (
                                  nbaInsightData.away.current_roster.players.map((p, idx) => (
                                    <div key={idx} className="insight-metric">
                                      <span>{p.name}</span>
                                      <strong>{p.position}</strong>
                                    </div>
                                  ))
                                ) : (
                                  <div className="insight-metric">
                                    <span>Status</span>
                                    <strong>
                                      {nbaInsightData.away.current_roster?.reason ||
                                        "Current roster information is unavailable from ESPN NBA Roster API for this team."}
                                    </strong>
                                  </div>
                                )}
                              </div>
                            </section>

                            <section className="insight-section player-section lineup-section">
                              <h4>Starting lineup</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Game-day status</span>
                                  <strong>This data source does not confirm starters. Check the official starting five close to tipoff.</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section player-section">
                              <h4>Top contributors</h4>
                              <div className="insight-metrics">
                                {nbaInsightData.away.notable_players && nbaInsightData.away.notable_players.length > 0 ? (
                                  nbaInsightData.away.notable_players.map((p, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className="insight-metric">
                                        <span>{p.name}</span>
                                        <strong>{`${p.position} · ${formatMetric(p.points_per_game)} PTS · ${formatMetric(
                                          p.rebounds_per_game
                                        )} REB · ${formatMetric(p.assists_per_game)} AST · ${formatMetric(
                                          p.steals_per_game
                                        )} STL · ${formatMetric(p.blocks_per_game)} BLK`}</strong>
                                      </div>
                                      {hasReportedInjury(p.availability) && (
                                        <div className="insight-metric injury-metric">
                                          <span>Reported injury</span>
                                          <strong>{`${p.name}: ${p.availability}`}</strong>
                                        </div>
                                      )}
                                    </React.Fragment>
                                  ))
                                ) : (
                                  <div className="insight-metric">
                                    <span>Status</span>
                                    <strong>No player statistics were returned from API-Sports for this season.</strong>
                                  </div>
                                )}
                              </div>
                            </section>
                          </article>
                        </div>
                      </div>
                    )}

                    {/* Sub-tab 2: Matchup Context */}
                    {analysisSubTab === 2 && (
                      <div className="analysis-tab-panel">
                        <article className="insight-summary">
                          <h3>Transparent matchup context</h3>
                          <div className="insight-scorecard">
                            <div>
                              <span>Home</span>
                              <strong>{nbaInsightData.home.team}</strong>
                              <b>{formatMetric(nbaInsightData.matchup_summary.estimated_home_points)}</b>
                            </div>
                            <div className="scorecard-total">
                              <span>Scoring blend</span>
                              <strong>{formatMetric(nbaInsightData.matchup_summary.estimated_total)} total</strong>
                              <i>Season-to-date</i>
                            </div>
                            <div>
                              <span>Away</span>
                              <strong>{nbaInsightData.away.team}</strong>
                              <b>{formatMetric(nbaInsightData.matchup_summary.estimated_away_points)}</b>
                            </div>
                          </div>

                          <p>
                            {`Scoring blend: ${nbaInsightData.home.team} ${formatMetric(
                              nbaInsightData.matchup_summary.estimated_home_points
                            )} — ${nbaInsightData.away.team} ${formatMetric(
                              nbaInsightData.matchup_summary.estimated_away_points
                            )}.`}
                          </p>
                          <p>{nbaInsightData.matchup_summary.method}</p>
                          {selectedInsightGame && (
                            <p>{marketComparison(selectedInsightGame, nbaInsightData.matchup_summary)}</p>
                          )}
                          <p className="jurisdiction-insight-note">{jurisdictionMessage()}</p>
                          <p>{nbaInsightData.matchup_summary.disclaimer}</p>
                        </article>
                      </div>
                    )}

                    {/* Sub-tab 3: AI Summary */}
                    {analysisSubTab === 3 && (
                      <div className="analysis-tab-panel">
                        <article className="ai-matchup-summary">
                          <h3>AI matchup summary</h3>
                          <p>
                            Create a concise explanation from the API-Sports data already loaded for this game. This does not replace live roster or injury checks and it does not provide a betting instruction.
                          </p>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isGeneratingAi}
                            onClick={handleGenerateAiSummary}
                          >
                            {isGeneratingAi ? "Writing summary…" : "Generate AI summary"}
                          </button>

                          {aiSummaryStatus && (
                            <p
                              className={`ai-summary-status ${aiSummaryStatus.isError ? "error" : ""}`}
                              aria-live="polite"
                            >
                              {aiSummaryStatus.text}
                            </p>
                          )}

                          {aiSummaryResult && (
                            <div className="ai-summary-output">
                              <p className="ai-summary-text">{aiSummaryResult.analysis}</p>
                              <p className="ai-summary-disclaimer">{aiSummaryResult.disclaimer}</p>
                            </div>
                          )}
                        </article>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
export default App;
