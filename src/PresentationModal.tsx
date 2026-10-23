import React, { useState, useEffect } from "react";

interface PresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Slide {
  id: number;
  title: string;
  category: string;
  duration: string;
  imageSrc: string;
  imageAlt: string;
  bulletPoints: string[];
  talkingPoints: string;
  whyItMatters: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    title: "Multi-Sportsbook Line Shopping",
    category: "Market Comparison",
    duration: "0:00 - 0:30",
    imageSrc: "/src/assets/images/slide_odds_comparison_1792723752100.jpg",
    imageAlt: "Edge Scanner Live Odds & Line Comparison Dashboard",
    bulletPoints: [
      "Compares real-time Point Spreads, Moneylines, and Totals across major books (DraftKings vs. FanDuel).",
      "Instant Edge Detection: Automatically highlights where you get the most favorable number or lowest vig.",
      "Regulatory Compliance: Real-time GPS & State jurisdiction detector with problem gaming resources.",
    ],
    talkingPoints:
      "\"Hello everyone. Today I'm presenting Edge Scanner. If you've ever looked at sports betting apps, you know sportsbooks take a 5 to 10 percent cut called 'the vig'. But different books offer different prices. Taking Kansas City at +2.0 on FanDuel instead of +1.5 on DraftKings can be the difference between winning and losing your bet. Edge Scanner scans authorized feeds side-by-side so you never take a bad price.\"",
    whyItMatters:
      "Line shopping is the #1 foundational math principle in sports analytics. Getting just a half-point or 10 cents better on odds turns negative expectation into long-term profit.",
  },
  {
    id: 2,
    title: "Deep Matchup Analytics & AI Game Breakdown",
    category: "Situational Intelligence",
    duration: "0:30 - 1:00",
    imageSrc: "/src/assets/images/slide_matchup_insights_1792723753626.jpg",
    imageAlt: "AI-Powered Matchup Insights & Efficiency Comparison",
    bulletPoints: [
      "Advanced Team Metrics: Net Rating, Offensive & Defensive Efficiency, Pace of Play, and True Shooting %.",
      "AI Tactical Synthesis: Analyzes pace clashes, matchup advantages, and high-possession trends.",
      "Responsible Risk Disclosures: Transparent volatility warnings so users never rely on blind predictions.",
    ],
    talkingPoints:
      "\"Next, casual fans bet on team names and hype. Edge Scanner replaces emotion with actual statistical indicators. When you click on any matchup, the app calculates efficiency differentials, tempo, and net ratings. It even pairs tactical analysis with responsible gaming volatility warnings to remind users of variance before risking any money.\"",
    whyItMatters:
      "Replaces emotional gambling with objective data analysis. It reveals hidden mismatches like a slow-paced half-court defense facing a fast-break transition offense.",
  },
  {
    id: 3,
    title: "Stadium Venue & Real-Time Weather Intelligence",
    category: "Environmental Factors",
    duration: "1:00 - 1:30",
    imageSrc: "/src/assets/images/slide_weather_venue_1792723754142.jpg",
    imageAlt: "Stadium Venue and Live Weather Impact Dashboard",
    bulletPoints: [
      "Venue Registry: Tracks open-air stadiums vs. indoor climate-controlled domes and turf types.",
      "Live Meteorological Feed: Captures kickoff temperature, wind speed, crosswind vectors, and precipitation.",
      "Historical Impact: Analyzes how 15+ mph winds decrease field goal accuracy by over 14% and stifle deep passes.",
    ],
    talkingPoints:
      "\"Here is one of our most powerful features: environmental impact. In football, weather can completely flip a game. Edge Scanner looks up the exact stadium—whether it's an open roof or a dome—and checks live weather at kickoff. For example, a 18 mph crosswind at MetLife Stadium drops field goal success by 14 percent and crushes over/under totals. Most bettors miss this; Edge Scanner puts it front and center.\"",
    whyItMatters:
      "Weather is the ultimate equalizer in outdoor sports. Knowing stadium roof status and wind speed prevents making bad Over bets in torrential conditions.",
  },
  {
    id: 4,
    title: "Smart Bet Slip OCR Scanner & Bankroll Discipline Ledger",
    category: "Discipline & Tracking",
    duration: "1:30 - 2:00",
    imageSrc: "/src/assets/images/slide_slip_scanner_1792723755043.jpg",
    imageAlt: "OCR Bet Slip Scanner and Bankroll Management Ledger",
    bulletPoints: [
      "Camera & Screenshot OCR: Instantly scans bet slips from any sportsbook, extracting event, odds, and stake.",
      "Unit Bankroll Discipline: Enforces strict 1-2% bankroll sizing to prevent emotional tilt and chasing losses.",
      "Local Privacy-First Storage: Keeps your wagers on your personal device without selling data to advertisers.",
    ],
    talkingPoints:
      "\"Finally, the secret of any successful analyst is bankroll discipline. Instead of tedious manual typing, users can snap a photo of any physical or digital bet slip. Our OCR engine parses the event, spread, and wager. Everything logs into a private personal ledger that tracks win rate, unit sizes, and ROI. It protects users from impulsive chasing and builds smart financial habits.\"",
    whyItMatters:
      "Without strict bankroll tracking, 90%+ of sports bettors lose money to bad money management. Edge Scanner automates the tracking so users stay disciplined.",
  },
];

const COMPLETE_SPEECH = `[0:00 - 0:25] THE HOOK & THE PROBLEM:
"Hello everyone! Have you ever wondered why sportsbooks make billions of dollars every year? It's not just luck—sportsbooks build in an edge called 'the vig' or juice, and casual bettors usually bet on gut feeling without comparing prices or tracking their spending. That's why I created Edge Scanner."

[0:25 - 0:55] FEATURE 1: LINE SHOPPING & ODDS COMPARISON:
"Edge Scanner solves this with three core pillars. First is Multi-Sportsbook Line Shopping. Just like you wouldn't buy a plane ticket without checking Google Flights, you shouldn't place a bet without checking where the best line is. Edge Scanner pulls authorized feeds from DraftKings and FanDuel side-by-side. Getting +2.0 points instead of +1.5, or -108 odds instead of -115, gives bettors free statistical expected value."

[0:55 - 1:25] FEATURE 2: MATCHUPS & WEATHER INTELLIGENCE:
"Second, Edge Scanner replaces guesswork with real data. When you tap a matchup, it shows offensive efficiency, pace of play, and net ratings. Even cooler: it connects to live weather and stadium data. If an NFL game has 18 mph crosswinds at an open-air stadium, field goal accuracy drops by 14% and deep passing crashes. Casual fans overlook this—Edge Scanner alerts you immediately."

[1:25 - 1:50] FEATURE 3: OCR SLIP SCANNER & BANKROLL DISCIPLINE:
"Third, and most importantly, is responsible bankroll discipline. Edge Scanner features an optical slip scanner: snap a photo of your ticket, and it auto-extracts your odds and stake into a private ledger to calculate your actual ROI and enforce healthy unit sizes."

[1:50 - 2:00] CONCLUSION & CALL TO ACTION:
"In summary: Edge Scanner isn't about gambling; it's about transparency, data analytics, and financial discipline. Feel free to open the shared link on your phones right now and try it out. Thank you!"`;

export function PresentationModal({ isOpen, onClose }: PresentationModalProps) {
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  if (!isOpen) return null;

  const currentSlide = SLIDES[currentSlideIdx];
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  const handleCopyScript = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(COMPLETE_SPEECH);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    }
  };

  return (
    <div className="presentation-backdrop" role="dialog" aria-modal="true" aria-labelledby="pres-title">
      <div className="presentation-modal">
        {/* Top Bar */}
        <div className="presentation-header">
          <div className="presentation-header-left">
            <span className="presentation-badge">CLASSROOM PRESENTATION DECK</span>
            <h2 id="pres-title" className="presentation-heading">
              Edge Scanner: 2-Minute Product Pitch
            </h2>
          </div>

          <div className="presentation-timer-bar">
            <div className="timer-display" title="Presenter Timer (Goal: 2:00)">
              <span className="timer-icon">⏱️</span>
              <span className={`timer-digits ${timerSeconds > 120 ? "timer-warning" : ""}`}>
                {formattedTime}
              </span>
              <span className="timer-target">/ 2:00</span>
            </div>
            <button
              type="button"
              className="btn-timer-toggle"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
            >
              {isTimerRunning ? "Pause" : "Start Timer"}
            </button>
            <button
              type="button"
              className="btn-timer-reset"
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds(0);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="presentation-close-btn"
              onClick={onClose}
              aria-label="Close presentation deck"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Slide Selector Tabs */}
        <div className="presentation-tabs">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              className={`slide-tab-btn ${idx === currentSlideIdx ? "active" : ""}`}
              onClick={() => setCurrentSlideIdx(idx)}
            >
              <span className="slide-tab-num">Slide {idx + 1}</span>
              <span className="slide-tab-name">{slide.title}</span>
            </button>
          ))}
          <button
            type="button"
            className="slide-tab-btn script-tab-btn"
            onClick={handleCopyScript}
            title="Copy full 2-minute speech to clipboard"
          >
            📋 {copiedScript ? "Script Copied!" : "Copy 2-Min Script"}
          </button>
        </div>

        {/* Slide Content Area */}
        <div className="presentation-body">
          {/* Left Column: High Res Screenshot */}
          <div className="slide-visual-column">
            <div className="slide-image-wrapper">
              <img
                src={currentSlide.imageSrc}
                alt={currentSlide.imageAlt}
                className="slide-screenshot-img"
                referrerPolicy="no-referrer"
              />
              <div className="slide-overlay-tag">
                <span>{currentSlide.category}</span>
                <span className="slide-time-tag">{currentSlide.duration}</span>
              </div>
            </div>
            <div className="slide-nav-controls">
              <button
                type="button"
                className="btn-slide-nav"
                disabled={currentSlideIdx === 0}
                onClick={() => setCurrentSlideIdx((prev) => Math.max(0, prev - 1))}
              >
                ← Previous Slide
              </button>
              <span className="slide-counter-indicator">
                Slide {currentSlideIdx + 1} of {SLIDES.length}
              </span>
              <button
                type="button"
                className="btn-slide-nav primary"
                disabled={currentSlideIdx === SLIDES.length - 1}
                onClick={() => setCurrentSlideIdx((prev) => Math.min(SLIDES.length - 1, prev + 1))}
              >
                Next Slide →
              </button>
            </div>
          </div>

          {/* Right Column: Slide Pitch & Talking Points */}
          <div className="slide-notes-column">
            <div className="notes-header">
              <span className="slide-category-pill">{currentSlide.category}</span>
              <span className="slide-duration-badge">Target Pace: 30 Seconds</span>
              <h3 className="slide-title-text">{currentSlide.title}</h3>
            </div>

            <div className="talking-points-box">
              <div className="box-title-row">
                <span className="box-icon">🎙️</span>
                <strong>Presenter Talking Points (Read Aloud):</strong>
              </div>
              <p className="speech-quote">{currentSlide.talkingPoints}</p>
            </div>

            <div className="features-checklist-box">
              <div className="box-title-row">
                <span className="box-icon">⚡</span>
                <strong>What This Screen Shows:</strong>
              </div>
              <ul className="bullet-points-list">
                {currentSlide.bulletPoints.map((bp, i) => (
                  <li key={i}>{bp}</li>
                ))}
              </ul>
            </div>

            <div className="why-it-matters-box">
              <div className="box-title-row">
                <span className="box-icon">💡</span>
                <strong>Why It's Important &amp; Why We Should Use It:</strong>
              </div>
              <p className="why-text">{currentSlide.whyItMatters}</p>
            </div>
          </div>
        </div>

        {/* Footer Summary / Quick Cheat Sheet */}
        <div className="presentation-footer">
          <div className="presentation-summary-pill">
            <strong>Key Presentation Takeaway:</strong> Edge Scanner converts sports betting from emotional guessing into a transparent, disciplined, data-driven analytical process.
          </div>
          <button
            type="button"
            className="btn-copy-script-footer"
            onClick={handleCopyScript}
          >
            {copiedScript ? "✅ Full Script Copied to Clipboard!" : "📋 Copy Full Word-for-Word Script"}
          </button>
        </div>
      </div>
    </div>
  );
}
