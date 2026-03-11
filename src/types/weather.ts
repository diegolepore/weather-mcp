/**
 * TypeScript interfaces for the Open-Meteo API responses.
 * These types describe the shape of JSON returned by the geocoding and forecast endpoints.
 */

/** A single location result from the Open-Meteo geocoding API. */
export interface GeocodingResult {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
}

/** Response from GET /v1/search (geocoding). Contains an optional array of results. */
export interface GeocodingResponse {
  results?: GeocodingResult[];
}

/** Units for current weather variables (e.g. "°C", "km/h"). Returned alongside current. */
export interface CurrentWeatherUnits {
  temperature_2m?: string;
  relative_humidity_2m?: string;
  wind_speed_10m?: string;
}

/** Current weather variables at a single timestamp. */
export interface CurrentWeather {
  time: string;
  interval: number;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  rain: number;
  showers: number;
  snowfall: number;
  weather_code: number;
  cloud_cover: number;
  pressure_msl: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
}

/** Response from the forecast API when requesting current=... (current weather). */
export interface CurrentWeatherResponse {
  current_units?: CurrentWeatherUnits;
  current?: CurrentWeather;
}

/** Units for daily forecast variables. Returned alongside daily. */
export interface DailyForecastUnits {
  temperature_2m_max?: string;
  temperature_2m_min?: string;
  precipitation_sum?: string;
  wind_speed_10m_max?: string;
}

/** Daily forecast arrays: one value per day (e.g. time[0], time[1], ...). */
export interface DailyForecast {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: (number | null)[];
  precipitation_sum: (number | null)[];
  rain_sum: (number | null)[];
  showers_sum: (number | null)[];
  snowfall_sum: (number | null)[];
  precipitation_hours: (number | null)[];
  precipitation_probability_max: (number | null)[];
  wind_speed_10m_max: (number | null)[];
  wind_gusts_10m_max: (number | null)[];
  wind_direction_10m_dominant: (number | null)[];
}

/** Response from the forecast API when requesting daily=... (7-day forecast). */
export interface DailyForecastResponse {
  daily_units?: DailyForecastUnits;
  daily?: DailyForecast;
}
