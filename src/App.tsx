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

  // Initial Load
  useEffect(() => {
    loadVenueTeamsList("nba");
    setTrackingEntries(getTrackingEntries());
    handleLoadOdds("nba", "draftkings,fanduel");
  }, []);

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

  // Device Location
  function handleUseDeviceLocation() {
    if (!navigator.geolocation) {
      setDeviceLocationStatus({
        text: "This browser cannot provide device location. Choose a state manually.",
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
            text: err.message || "Unable to suggest a state from device location.",
            isError: true,
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        let msg = "Device location could not be determined. Choose a state manually.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Device location was not shared. You can choose any state manually.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Device location took too long. Try again or choose a state manually.";
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
    setOddsStatus({ text: "Requesting authorized live odds…" });

    try {
      const data = await fetchLiveOdds(selectedLg, books.trim());
      setSummaryData({
        eventCount: data.event_count,
        requestsRemaining: data.usage.requests_remaining ?? "—",
        markets: data.markets,
      });

      const booksSeen = Array.from(
        new Set(
          data.events.flatMap((e) => (e.bookmakers || []).map((b) => b.title)).filter(Boolean)
        )
      );
      setDisplayedSportsbooks(booksSeen);
      setEvents(data.events);

      setOddsStatus({
        text: data.cached
          ? "Showing a recent cached response to preserve API credits."
          : "Live lines loaded from your authorized provider.",
      });
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
        const data = await fetchNflInsights(game.home_team, game.away_team, season);
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
            <label>
              League
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
            </label>

            <label className="bookmakers-label">
              Sportsbooks
              <input
                id="bookmakers"
                value={bookmakersInput}
                onChange={(e) => setBookmakersInput(e.target.value)}
                aria-describedby="bookmaker-help"
              />
              <span id="bookmaker-help">Comma-separated provider keys</span>
            </label>

            <label className="jurisdiction-label">
              Betting jurisdiction
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
              <span id="jurisdiction-help">
                Choose any location manually, or use your device to suggest the current state.
              </span>
            </label>

            <div className="device-location-control">
              <button
                id="use-device-location"
                className="secondary-button"
                type="button"
                disabled={isLocating}
                onClick={handleUseDeviceLocation}
                aria-describedby="device-location-help"
              >
                {isLocating ? "Detecting…" : "Use device location"}
              </button>
              <span id="device-location-help">
                Optional: asks your browser for location, then sends an approximate coordinate once to the U.S. Census Bureau Geocoder to suggest a state. Edge Scanner does not save coordinates or share them with sportsbooks.
              </span>
            </div>

            <button
              id="refresh"
              type="button"
              disabled={isLoadingOdds}
              onClick={() => handleLoadOdds(league, bookmakersInput)}
            >
              {isLoadingOdds ? "Loading…" : "Refresh lines"}
            </button>
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
            <section id="summary" className="summary">
              <span>
                <strong>{summaryData.eventCount}</strong> events
              </span>
              <span>
                <strong>{summaryData.requestsRemaining}</strong> credits remaining
              </span>
              <span>Markets: {summaryData.markets.join(", ")}</span>
            </section>
          )}

          {/* Events list */}
          <section id="events" className="events" aria-live="polite">
            {events.map((evt) => (
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
            ))}
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

              <label className="file-picker" htmlFor="slip-image">
                <span>Camera or image</span>
                <input
                  id="slip-image"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
                    if (file) {
                      setSelectedImageFile(file);
                      setSelectedImageUrl(URL.createObjectURL(file));
                      setTrackingSource("manual");
                      setScanStatus({
                        text: "Image selected. You can read it with OCR or enter the fields yourself.",
                      });
                    } else {
                      setSelectedImageFile(null);
                      setSelectedImageUrl(null);
                    }
                  }}
                />
              </label>

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
                    {["Overview", "Key availability", "Opponent strength", "Matchup context", "AI summary"].map(
                      (label, idx) => (
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
                      )
                    )}
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
                              <h3>{nflInsightData.home.team}</h3>
                            </header>

                            <section className="insight-section quarterback-section">
                              <h4>Quarterback</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Starter by passing yards</span>
                                  <strong>{nflInsightData.home.quarterback?.name || "Quarterback unavailable"}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Passing yards</span>
                                  <strong>
                                    {`${formatMetric(nflInsightData.home.quarterback?.passing_yards)} · ${formatMetric(
                                      nflInsightData.home.quarterback?.passing_yards_per_game,
                                      " / game"
                                    )}`}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Passing TD / INT</span>
                                  <strong>
                                    {`${formatMetric(nflInsightData.home.quarterback?.passing_touchdowns)} / ${formatMetric(
                                      nflInsightData.home.quarterback?.passing_interceptions
                                    )}`}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Rushing yards</span>
                                  <strong>
                                    {`${formatMetric(nflInsightData.home.quarterback?.rushing_yards)} · ${formatMetric(
                                      nflInsightData.home.quarterback?.rushing_yards_per_game,
                                      " / game"
                                    )}`}
                                  </strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Rushing TD</span>
                                  <strong>{formatMetric(nflInsightData.home.quarterback?.rushing_touchdowns)}</strong>
                                </div>
                                <div className="insight-metric">
                                  <span>Sacks taken</span>
                                  <strong>{formatMetric(nflInsightData.home.quarterback?.sacks_taken)}</strong>
                                </div>
                              </div>
                            </section>

                            <section className="insight-section">
                              <h4>Offense</h4>
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
                            </section>

                            <section className="insight-section">
                              <h4>Defense</h4>
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
                            </section>
                          </article>

                          {/* Away Team */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Away team</span>
                              <h3>{nflInsightData.away.team}</h3>
                            </header>

                            <section className="insight-section quarterback-section">
                              <h4>Quarterback</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Starter by passing yards</span>
                                  <strong>{nflInsightData.away.quarterback?.name || "Quarterback unavailable"}</strong>
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
                            </section>

                            <section className="insight-section">
                              <h4>Offense</h4>
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
                            </section>

                            <section className="insight-section">
                              <h4>Defense</h4>
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
                        <div className="insight-team-grid">
                          {/* Home Opponent Strength */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Home team</span>
                              <h3>{nflInsightData.home.team}</h3>
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
                              <h4>How to read this</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Season context</span>
                                  <strong>{nflInsightData.home.opponent_strength.method}</strong>
                                </div>
                              </div>
                            </section>
                          </article>

                          {/* Away Opponent Strength */}
                          <article className="insight-team">
                            <header className="insight-team-header">
                              <span className="insight-team-role">Away team</span>
                              <h3>{nflInsightData.away.team}</h3>
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
                              <h4>How to read this</h4>
                              <div className="insight-metrics">
                                <div className="insight-metric">
                                  <span>Season context</span>
                                  <strong>{nflInsightData.away.opponent_strength.method}</strong>
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
