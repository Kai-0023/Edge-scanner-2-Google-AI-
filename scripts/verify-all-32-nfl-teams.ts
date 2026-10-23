import { validateAll32NflTeamsOpponentStrength } from "../src/logic/oddsAndInsights";

async function runAudit() {
  console.log("==========================================================");
  console.log("   NFL 32-TEAM OPPONENT STRENGTH VALIDATION TEST");
  console.log("==========================================================");

  const season = "2026";
  console.log(`Starting live audit for NFL Season: ${season}...`);
  const report = await validateAll32NflTeamsOpponentStrength(season, true);

  console.log(`\nResults:`);
  console.log(`  Source:                     ${report.source}`);
  console.log(`  Season:                     ${report.season}`);
  console.log(`  Completed Regular Games:    ${report.total_regular_season_games}`);
  console.log(`  League Average Scoring:     ${report.league_average_ppg} PPG`);
  console.log(`  Total Franchises Checked:   ${report.total_teams}`);
  console.log(`  Verified Franchises:        ${report.verified_count} / ${report.total_teams}`);
  console.log(`  Missing / Fallback Count:   ${report.missing_or_failed_count}`);
  console.log(`  Audit Status:               ${report.all_teams_verified ? "PASSED (100% Verified)" : "FAILED"}`);

  console.log("\n----------------------------------------------------------");
  console.log("Franchise Breakdown:");
  console.log("----------------------------------------------------------");

  for (const t of report.teams) {
    const byeNote = t.games_completed < 6 ? " (Bye/Schedule)" : "";
    console.log(
      `[${t.status === "verified" ? "OK" : "ERR"}] ${t.team.padEnd(26)} (${t.abbr.padEnd(3)}) | Games: ${String(t.games_completed).padStart(2)}${byeNote.padEnd(16)} | PPG: ${String(t.ppg).padStart(4)} | Def: ${String(t.opp_ppg).padStart(4)} | OppDef: ${String(t.avg_opponent_defensive_ppg).padStart(4)} | Sched: ${t.schedule_difficulty.padEnd(9)} | Opponents: ${t.opponents_faced.join(", ")}`
    );
  }

  if (!report.all_teams_verified || report.missing_or_failed_count > 0) {
    console.error("\n❌ VALIDATION FAILED: Some teams have missing or fallback opponent-strength data.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL 32 NFL TEAMS VERIFIED WITH ACCURATE CURRENT-SEASON COMPLETED SCHEDULES.");
  }
}

runAudit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
