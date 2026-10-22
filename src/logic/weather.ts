export interface WeatherConditions {
  temperature_f: number;
  precipitation_probability_percent: number;
  wind_speed_mph: number;
  wind_gusts_mph: number;
  weather_code: number;
  weather_description: string;
}

export interface GameWeather {
  source: string;
  venue_coordinates: { latitude: number; longitude: number };
  forecast_time_local: string;
  timezone?: string;
  conditions: WeatherConditions;
  review_flags: string[];
  model_note: string;
}

const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export async function fetchGameWeather(
  latitude: number,
  longitude: number,
  gameTimeLocal: string
): Promise<GameWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "16");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Open-Meteo is unavailable right now.");
  }
  const payload = await response.json();
  const hourly = payload.hourly;
  if (!hourly || !hourly.time || !hourly.time.length) {
    throw new Error("The weather provider did not return a complete hourly forecast.");
  }

  const times: string[] = hourly.time;
  const targetDate = new Date(gameTimeLocal);
  const targetTime = targetDate.getTime();

  let closestIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }

  // If outside 3 days range or more than 48 hours diff, still return best available with note
  const weatherCode = hourly.weather_code[closestIndex] ?? 0;
  const temperature = hourly.temperature_2m[closestIndex] ?? 70;
  const precipProb = hourly.precipitation_probability[closestIndex] ?? 0;
  const windSpeed = hourly.wind_speed_10m[closestIndex] ?? 5;
  const windGusts = hourly.wind_gusts_10m[closestIndex] ?? 8;

  const reviewFlags: string[] = [];
  if (precipProb >= 50) {
    reviewFlags.push("Precipitation probability is elevated.");
  }
  if (windSpeed >= 15 || windGusts >= 25) {
    reviewFlags.push("Wind conditions may be meaningful for passing and kicking.");
  }
  if (weatherCode >= 51) {
    reviewFlags.push("The forecast includes precipitation or a severe-weather condition.");
  }
  if (reviewFlags.length === 0) {
    reviewFlags.push("No high-level weather flag was triggered by this simple screen.");
  }

  return {
    source: "Open-Meteo",
    venue_coordinates: { latitude, longitude },
    forecast_time_local: times[closestIndex],
    timezone: payload.timezone,
    conditions: {
      temperature_f: temperature,
      precipitation_probability_percent: precipProb,
      wind_speed_mph: windSpeed,
      wind_gusts_mph: windGusts,
      weather_code: weatherCode,
      weather_description: WEATHER_CODES[weatherCode] || "Unclassified condition",
    },
    review_flags: reviewFlags,
    model_note: "Use this as current context for the NFL weather input. Edge Scanner does not automatically change a projection from this forecast.",
  };
}
