export interface NbaTeamFactors {
  team_name?: string;
  offensive_rating: number;
  defensive_rating: number;
  recent_net_rating?: number;
  pace?: number;
  rest_days?: number;
  injury_adjustment?: number;
}

export interface NflTeamFactors {
  team_name?: string;
  offense_points: number;
  defense_points_allowed: number;
  recent_rating?: number;
  rest_days?: number;
  qb_adjustment?: number;
  injury_adjustment?: number;
  weather_adjustment?: number;
}

export interface ProjectionResult {
  projected_home_margin: number;
  projected_total: number;
  home_win_probability: number;
  expected_possessions?: number;
}

export interface ModelDriver {
  factor: string;
  model_impact_points: number;
  favors: string;
}

export interface MatchupInsight {
  method: string;
  baseline_signal: string;
  summary: string;
  drivers: ModelDriver[];
  disclaimer: string;
  league: string;
}

export function winProbability(margin: number, scale = 6.5): number {
  return Number((1 / (1 + Math.exp(-margin / scale))).toFixed(4));
}

export function nbaProjection(home: NbaTeamFactors, away: NbaTeamFactors): ProjectionResult {
  const homePace = home.pace ?? 100;
  const awayPace = away.pace ?? 100;
  const expectedPossessions = (homePace + awayPace) / 2;

  const homeBase = ((home.offensive_rating + away.defensive_rating) / 2) * expectedPossessions / 100;
  const awayBase = ((away.offensive_rating + home.defensive_rating) / 2) * expectedPossessions / 100;

  const homeRest = home.rest_days ?? 1;
  const awayRest = away.rest_days ?? 1;
  const homeNet = home.recent_net_rating ?? 0;
  const awayNet = away.recent_net_rating ?? 0;
  const homeInj = home.injury_adjustment ?? 0;
  const awayInj = away.injury_adjustment ?? 0;

  const margin =
    homeBase -
    awayBase +
    1.75 +
    0.4 * (homeRest - awayRest) +
    0.2 * (homeNet - awayNet) +
    homeInj -
    awayInj;

  const total = homeBase + awayBase + homeInj + awayInj;

  return {
    projected_home_margin: Number(margin.toFixed(1)),
    projected_total: Number(total.toFixed(1)),
    home_win_probability: winProbability(margin),
    expected_possessions: Number(expectedPossessions.toFixed(1)),
  };
}

export function nflProjection(home: NflTeamFactors, away: NflTeamFactors): ProjectionResult {
  const homeBase = (home.offense_points + away.defense_points_allowed) / 2;
  const awayBase = (away.offense_points + home.defense_points_allowed) / 2;

  const homeRest = home.rest_days ?? 7;
  const awayRest = away.rest_days ?? 7;
  const homeRec = home.recent_rating ?? 0;
  const awayRec = away.recent_rating ?? 0;
  const homeQb = home.qb_adjustment ?? 0;
  const awayQb = away.qb_adjustment ?? 0;
  const homeInj = home.injury_adjustment ?? 0;
  const awayInj = away.injury_adjustment ?? 0;
  const homeWea = home.weather_adjustment ?? 0;
  const awayWea = away.weather_adjustment ?? 0;

  const margin =
    homeBase -
    awayBase +
    1.5 +
    0.25 * (homeRest - awayRest) +
    0.35 * (homeRec - awayRec) +
    homeQb -
    awayQb +
    homeInj -
    awayInj +
    homeWea -
    awayWea;

  const total = homeBase + awayBase + homeQb + awayQb + homeInj + awayInj + homeWea + awayWea;

  return {
    projected_home_margin: Number(margin.toFixed(1)),
    projected_total: Number(total.toFixed(1)),
    home_win_probability: winProbability(margin),
  };
}

function signalStrength(prob: number): string {
  const diff = Math.abs(prob - 0.5);
  if (diff >= 0.22) return "strong baseline signal";
  if (diff >= 0.1) return "moderate baseline signal";
  return "limited baseline signal";
}

function driver(label: string, impact: number, homeName: string, awayName: string): ModelDriver {
  return {
    factor: label,
    model_impact_points: Number(impact.toFixed(2)),
    favors: impact >= 0 ? homeName : awayName,
  };
}

export function nbaMatchupInsight(
  home: NbaTeamFactors,
  away: NbaTeamFactors,
  proj: ProjectionResult
): MatchupInsight {
  const homeName = home.team_name || "Home team";
  const awayName = away.team_name || "Away team";
  const homePace = home.pace ?? 100;
  const awayPace = away.pace ?? 100;
  const expectedPoss = (homePace + awayPace) / 2;

  const homeBase = ((home.offensive_rating + away.defensive_rating) / 2) * expectedPoss / 100;
  const awayBase = ((away.offensive_rating + home.defensive_rating) / 2) * expectedPoss / 100;

  const homeRest = home.rest_days ?? 1;
  const awayRest = away.rest_days ?? 1;
  const homeNet = home.recent_net_rating ?? 0;
  const awayNet = away.recent_net_rating ?? 0;
  const homeInj = home.injury_adjustment ?? 0;
  const awayInj = away.injury_adjustment ?? 0;

  const drivers: ModelDriver[] = [
    driver("Home-court baseline", 1.75, homeName, awayName),
    driver("Base efficiency gap", homeBase - awayBase, homeName, awayName),
    driver("Rest advantage", 0.4 * (homeRest - awayRest), homeName, awayName),
    driver("Recent form gap", 0.2 * (homeNet - awayNet), homeName, awayName),
    driver("Injury adjustment", homeInj - awayInj, homeName, awayName),
  ];

  const margin = proj.projected_home_margin;
  const prob = proj.home_win_probability;
  const favored = margin >= 0 ? homeName : awayName;

  return {
    method: "Transparent rule-based explanation (not trained ML)",
    baseline_signal: signalStrength(prob),
    summary: `The baseline projects ${favored} by ${Math.abs(margin).toFixed(1)} points. It assigns ${homeName} a ${(prob * 100).toFixed(0)}% home-win probability based on the supplied factors.`,
    drivers: drivers.sort((a, b) => Math.abs(b.model_impact_points) - Math.abs(a.model_impact_points)),
    disclaimer: "This is an explanation of user-supplied inputs, not financial advice or a guarantee. Validate inputs and local requirements before making any decision.",
    league: "nba",
  };
}

export function nflMatchupInsight(
  home: NflTeamFactors,
  away: NflTeamFactors,
  proj: ProjectionResult
): MatchupInsight {
  const homeName = home.team_name || "Home team";
  const awayName = away.team_name || "Away team";

  const homeBase = (home.offense_points + away.defense_points_allowed) / 2;
  const awayBase = (away.offense_points + home.defense_points_allowed) / 2;

  const homeRest = home.rest_days ?? 7;
  const awayRest = away.rest_days ?? 7;
  const homeRec = home.recent_rating ?? 0;
  const awayRec = away.recent_rating ?? 0;
  const homeQb = home.qb_adjustment ?? 0;
  const awayQb = away.qb_adjustment ?? 0;
  const homeInj = home.injury_adjustment ?? 0;
  const awayInj = away.injury_adjustment ?? 0;
  const homeWea = home.weather_adjustment ?? 0;
  const awayWea = away.weather_adjustment ?? 0;

  const drivers: ModelDriver[] = [
    driver("Home field baseline", 1.5, homeName, awayName),
    driver("Base scoring gap", homeBase - awayBase, homeName, awayName),
    driver("Rest differential", 0.25 * (homeRest - awayRest), homeName, awayName),
    driver("Recent form", 0.35 * (homeRec - awayRec), homeName, awayName),
    driver("Quarterback situation", homeQb - awayQb, homeName, awayName),
    driver("Injury impacts", homeInj - awayInj, homeName, awayName),
    driver("Weather conditions", homeWea - awayWea, homeName, awayName),
  ];

  const margin = proj.projected_home_margin;
  const prob = proj.home_win_probability;
  const favored = margin >= 0 ? homeName : awayName;

  return {
    method: "Transparent rule-based explanation (not trained ML)",
    baseline_signal: signalStrength(prob),
    summary: `The baseline projects ${favored} by ${Math.abs(margin).toFixed(1)} points. It assigns ${homeName} a ${(prob * 100).toFixed(0)}% home-win probability based on the supplied factors.`,
    drivers: drivers.sort((a, b) => Math.abs(b.model_impact_points) - Math.abs(a.model_impact_points)),
    disclaimer: "This is an explanation of user-supplied inputs, not financial advice or a guarantee. Validate inputs and local requirements before making any decision.",
    league: "nfl",
  };
}
