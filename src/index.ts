// =============================================================================
// 1. IMPORTS & SERVER SETUP
// =============================================================================
// MCP SDK: McpServer is the main server class; StdioServerTransport connects it
// to stdin/stdout so clients (e.g. Cursor, Claude Desktop) can talk to the server.
// We use zod to define and validate tool input schemas.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type {
  GeocodingResponse,
  CurrentWeatherResponse,
  DailyForecastResponse,
} from "./types/weather.js";

// Create the MCP server instance. The name and version identify this server
// to clients and may appear in logs or UI.
const server = new McpServer({ name: "weather", version: "1.0.0" });

// =============================================================================
// 2. WMO WEATHER CODE MAP
// =============================================================================
// Open-Meteo returns a numeric weather_code. This map converts each code to a
// human-readable description (WMO Weather interpretation codes).
const WMO_WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
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

// =============================================================================
// 3. HELPER FUNCTIONS (API CALLS)
// =============================================================================
// These functions call external APIs and return null on any error. Tool handlers
// then turn null into user-friendly messages. Never throw from helpers so the
// server stays stable and we can return structured error content.

async function geocodeCity(
  city: string
): Promise<{ latitude: number; longitude: number; name: string; country: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as GeocodingResponse;
    const first = data.results?.[0];
    if (!first) return null;
    return {
      latitude: first.latitude,
      longitude: first.longitude,
      name: first.name,
      country: first.country ?? "",
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

async function fetchCurrentWeather(
  lat: number,
  lon: number
): Promise<CurrentWeatherResponse | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=auto`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as CurrentWeatherResponse;
  } catch (error) {
    console.error("Current weather fetch error:", error);
    return null;
  }
}

async function fetchDailyForecast(
  lat: number,
  lon: number
): Promise<DailyForecastResponse | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=auto&forecast_days=7`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as DailyForecastResponse;
  } catch (error) {
    console.error("Daily forecast fetch error:", error);
    return null;
  }
}

// =============================================================================
// 4. TOOL REGISTRATION
// =============================================================================
// Tools are the capabilities the MCP server exposes to the client. Each tool has:
//   - A unique name (used in protocol messages)
//   - A description (helps the LLM decide when to call it)
//   - An inputSchema (zod schemas; the SDK uses these for validation)
//   - An async handler that returns content: [{ type: "text", text: "..." }]
// Use server.registerTool() only (not server.tool()). Return text content only.

// --- Tool: get_current_weather ---
// Resolves the city name to coordinates, fetches current conditions, and
// returns a natural-language summary (temperature, conditions, wind, etc.).
server.registerTool(
  "get_current_weather",
  {
    description: "Get current weather for a city (works globally)",
    inputSchema: {
      city: z.string().describe("City name (e.g. Madrid, Tokyo, New York)"),
    },
  },
  async ({ city }) => {
    const location = await geocodeCity(city);
    if (!location) {
      return {
        content: [{ type: "text", text: `Could not find a city named "${city}". Please check the spelling or try a different city.` }],
      };
    }

    const data = await fetchCurrentWeather(location.latitude, location.longitude);
    if (!data?.current) {
      return {
        content: [{ type: "text", text: "Failed to retrieve current weather for that location. Please try again later." }],
      };
    }

    const c = data.current;
    const units = data.current_units ?? {};
    const tempUnit = units.temperature_2m ?? "°C";
    const windUnit = units.wind_speed_10m ?? "km/h";
    const weatherDesc = WMO_WEATHER_CODES[c.weather_code] ?? "Unknown";
    const locationLabel = location.country ? `${location.name}, ${location.country}` : location.name;
    const dayNight = c.is_day === 1 ? "Day" : "Night";

    const lines = [
      `Current weather in ${locationLabel}`,
      ``,
      `Temperature: ${c.temperature_2m}${tempUnit} (feels like ${c.apparent_temperature}${tempUnit})`,
      `Conditions: ${weatherDesc}. ${dayNight}.`,
      `Humidity: ${c.relative_humidity_2m}%`,
      `Wind: ${c.wind_speed_10m} ${windUnit} from ${c.wind_direction_10m}°, gusts up to ${c.wind_gusts_10m} ${windUnit}`,
      `Precipitation: ${c.precipitation} mm (rain: ${c.rain}, showers: ${c.showers}, snow: ${c.snowfall} mm)`,
      `Cloud cover: ${c.cloud_cover}%`,
      `Pressure: ${c.pressure_msl} hPa (surface ${c.surface_pressure} hPa)`,
    ];
    const text = lines.join("\n");

    return {
      content: [{ type: "text", text }],
    };
  }
);

// --- Tool: get_weather_forecast ---
// Resolves the city, fetches the 7-day daily forecast, and returns a
// natural-language summary for each day (highs/lows, precipitation, UV, etc.).
server.registerTool(
  "get_weather_forecast",
  {
    description: "Get 7-day weather forecast for a city (works globally)",
    inputSchema: {
      city: z.string().describe("City name (e.g. Madrid, Tokyo, New York)"),
    },
  },
  async ({ city }) => {
    const location = await geocodeCity(city);
    if (!location) {
      return {
        content: [{ type: "text", text: `Could not find a city named "${city}". Please check the spelling or try a different city.` }],
      };
    }

    const data = await fetchDailyForecast(location.latitude, location.longitude);
    if (!data?.daily) {
      return {
        content: [{ type: "text", text: "Failed to retrieve forecast for that location. Please try again later." }],
      };
    }

    const d = data.daily;
    const units = data.daily_units ?? {};
    const tempUnit = units.temperature_2m_max ?? "°C";
    const windUnit = units.wind_speed_10m_max ?? "km/h";
    const precipUnit = units.precipitation_sum ?? "mm";
    const locationLabel = location.country ? `${location.name}, ${location.country}` : location.name;

    const dayCount = d.time?.length ?? 0;
    const dayLines: string[] = [];

    for (let i = 0; i < dayCount; i++) {
      const date = d.time[i] ?? "—";
      const weatherDesc = WMO_WEATHER_CODES[d.weather_code?.[i] ?? -1] ?? "Unknown";
      const high = d.temperature_2m_max?.[i] ?? "—";
      const low = d.temperature_2m_min?.[i] ?? "—";
      const precipProb = d.precipitation_probability_max?.[i] ?? "—";
      const precipSum = d.precipitation_sum?.[i] ?? "—";
      const windSpeed = d.wind_speed_10m_max?.[i] ?? "—";
      const uv = d.uv_index_max?.[i] ?? "—";

      dayLines.push(
        `${date}: ${weatherDesc}. High ${high}${tempUnit}, low ${low}${tempUnit}. ` +
        `Precipitation: ${precipSum} ${precipUnit} (max probability ${precipProb}%). Wind ${windSpeed} ${windUnit}. UV index ${uv}.`
      );
    }

    const text = [
      `7-day forecast for ${locationLabel}`,
      ``,
      ...dayLines,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
    };
  }
);

// =============================================================================
// 5. MAIN ENTRY POINT
// =============================================================================
// Transport: how the MCP server sends and receives messages.
//
// We use StdioServerTransport, which means the server communicates through
// the terminal's standard streams:
//   - stdin  (standard input)  → receives JSON-RPC messages from the client
//   - stdout (standard output) → sends JSON-RPC responses back to the client
//
// This works because Claude Desktop doesn't connect to our server over a
// network — it launches our process directly and talks to it through these
// pipes, the same way a terminal passes text between commands (e.g. ls | grep).
//
// Because stdout is the protocol's dedicated channel, we must never write
// anything else to it. console.log() writes to stdout and would corrupt the
// message stream, breaking the server silently. console.error() is safe
// because it writes to stderr, a separate stream the protocol ignores.
//
// On fatal startup errors we call process.exit(1) so the process terminates
// cleanly. Without it, Node can hang in a broken state and Claude Desktop
// won't detect that the server failed to launch.

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
