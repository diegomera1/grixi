"use client";

import { useState, useEffect } from "react";
import { fetchMarineWeather, fetchNOAATides } from "../actions/maritime-weather-action";

// ─── Types ──────────────────────────────────────

export type MarineWeather = {
  airTemp: number;
  feelsLike: number;
  waterTemp: number;
  humidity: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  cloudCover: number;
  precipitation: number;
  windSpeed: number;
  windDir: string;
  windDeg: number;
  windGust: number;
  waveHeight: number;
  wavePeriod: number;
  waveDir: string;
  currentSpeed: number;
  currentDir: string;
  seaState: string;
  beaufortScale: number;
  douglasScale: number;
  sunrise: string;
  sunset: string;
  description: string;
  icon: string;
};

export type WeatherForecast = {
  hour: string;
  airTemp: number;
  windSpeed: number;
  windDir: string;
  waveHeight: number;
  precipitation: number;
  icon: string;
  description: string;
};

export type TideEntry = {
  time: string;
  height: number;
  type: "high" | "low";
};

export type NOAAData = {
  stationName: string;
  stationId: string;
  tides: TideEntry[];
  waterLevel: number;
  waterTemperature: number;
  airPressure: number;
};

export type NearbyVessel = {
  mmsi: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  sog: number;
  distance_nm: number;
  bearing: number;
};

export type AISVessel = {
  mmsi: string;
  imo: string;
  name: string;
  type: string;
  flag: string;
  lat: number;
  lon: number;
  heading: number;
  sog: number;
  cog: number;
  draft: number;
  destination: string;
  eta: string;
  status: "underway" | "anchored" | "moored" | "not_under_command";
  lastUpdate: string;
};

export type AISTrackPoint = {
  lat: number;
  lon: number;
  timestamp: string;
  sog: number;
  cog: number;
};

export type RouteWaypoint = {
  name: string;
  lat: number;
  lon: number;
  status: "departed" | "current" | "next" | "pending";
  eta?: string;
  arrived?: string;
  port_code?: string;
  berth?: string;
};

export type RouteProgress = {
  pct: number;
  traveled_nm: number;
  remaining_nm: number;
  total_nm: number;
  eta_final: string;
  avg_speed: number;
  fuel_consumed: number;
  fuel_remaining: number;
};

export type MaritimeData = {
  vessel: AISVessel;
  track: AISTrackPoint[];
  nearbyVessels: NearbyVessel[];
  weather: MarineWeather;
  forecast: WeatherForecast[];
  noaa: NOAAData;
  route: RouteWaypoint[];
  progress: RouteProgress;
  dataSource: {
    weather: "live" | "demo";
    tides: "live" | "demo";
    ais: "demo";
  };
};

// ─── Helpers ────────────────────────────────────

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function beaufortToSeaState(bf: number): string {
  const states = ["Calma", "Calma", "Rizada", "Marejadilla", "Marejada", "Fuerte marejada", "Marejada gruesa", "Temporal", "Temporal duro", "Temporal muy duro"];
  return states[Math.min(bf, states.length - 1)];
}

function beaufortToDouglas(bf: number): number {
  if (bf <= 1) return 0;
  if (bf <= 3) return 2;
  if (bf <= 4) return 3;
  if (bf <= 5) return 4;
  if (bf <= 6) return 5;
  if (bf <= 7) return 6;
  return Math.min(bf, 9);
}

function estimateWaveHeight(windSpeedKnots: number): number {
  // Simplified Pierson-Moskowitz wave height estimate
  return +(0.0246 * Math.pow(windSpeedKnots, 1.5) * 0.3048).toFixed(1);
}

// ─── Demo AIS/Route data ────────────────────────

const DEMO_VESSEL: AISVessel = {
  mmsi: "735000123",
  imo: "9876543",
  name: "MV GRIXI PACÍFICO",
  type: "Chemical/Products Tanker",
  flag: "🇪🇨 Ecuador",
  lat: -1.5200,
  lon: -80.2100,
  heading: 195,
  sog: 12.4,
  cog: 195,
  draft: 8.5,
  destination: "ECGYE (Guayaquil)",
  eta: "2026-03-20T19:00:00Z",
  status: "underway",
  lastUpdate: new Date().toISOString(),
};

const DEMO_TRACK: AISTrackPoint[] = [
  { lat: -0.9537, lon: -80.7339, timestamp: "2026-03-16T08:00:00Z", sog: 0, cog: 0 },
  { lat: -1.0100, lon: -80.6800, timestamp: "2026-03-16T10:00:00Z", sog: 8.2, cog: 160 },
  { lat: -1.0800, lon: -80.5900, timestamp: "2026-03-16T14:00:00Z", sog: 10.1, cog: 170 },
  { lat: -1.1500, lon: -80.5200, timestamp: "2026-03-17T02:00:00Z", sog: 11.5, cog: 175 },
  { lat: -1.2200, lon: -80.4500, timestamp: "2026-03-17T12:00:00Z", sog: 12.0, cog: 180 },
  { lat: -1.3000, lon: -80.3800, timestamp: "2026-03-18T00:00:00Z", sog: 12.3, cog: 185 },
  { lat: -1.3800, lon: -80.3200, timestamp: "2026-03-18T12:00:00Z", sog: 12.4, cog: 190 },
  { lat: -1.4500, lon: -80.2600, timestamp: "2026-03-19T06:00:00Z", sog: 12.1, cog: 192 },
  { lat: -1.5200, lon: -80.2100, timestamp: new Date().toISOString(), sog: 12.4, cog: 195 },
];

const DEMO_NEARBY: NearbyVessel[] = [
  { mmsi: "369970815", name: "STENA VISION", type: "Tanker", lat: -1.48, lon: -80.35, sog: 10.2, distance_nm: 8.5, bearing: 290 },
  { mmsi: "244780000", name: "CAPE SOUNIO", type: "Bulk Carrier", lat: -1.60, lon: -80.10, sog: 11.8, distance_nm: 6.2, bearing: 155 },
  { mmsi: "538006769", name: "PACIFIC TRADER", type: "Container", lat: -1.35, lon: -80.30, sog: 14.5, distance_nm: 12.1, bearing: 340 },
  { mmsi: "352001234", name: "DON JULIO", type: "Fishing", lat: -1.55, lon: -80.25, sog: 3.1, distance_nm: 2.8, bearing: 220 },
  { mmsi: "735091234", name: "ISLA PUNÁ", type: "Tug", lat: -2.10, lon: -79.95, sog: 8.0, distance_nm: 40.2, bearing: 175 },
];

const DEMO_ROUTE: RouteWaypoint[] = [
  { name: "Manta", lat: -0.9537, lon: -80.7339, status: "departed", arrived: "2026-03-16 08:00", port_code: "ECMEC", berth: "Muelle A-3" },
  { name: "En Ruta", lat: -1.5200, lon: -80.2100, status: "current" },
  { name: "Guayaquil", lat: -2.1894, lon: -79.8891, status: "next", eta: "2026-03-20 19:00", port_code: "ECGYE", berth: "TPG" },
  { name: "Canal de Panamá", lat: 8.9500, lon: -79.5667, status: "pending", eta: "2026-03-25 06:00", port_code: "PACNL" },
  { name: "Cartagena", lat: 10.3910, lon: -75.5144, status: "pending", eta: "2026-03-27 18:00", port_code: "COCTG" },
  { name: "Houston", lat: 29.7604, lon: -95.3698, status: "pending", eta: "2026-04-02 08:00", port_code: "USHOU" },
];

const DEMO_PROGRESS: RouteProgress = {
  pct: 6,
  traveled_nm: 180,
  remaining_nm: 2670,
  total_nm: 2850,
  eta_final: "2026-04-02T08:00:00Z",
  avg_speed: 11.8,
  fuel_consumed: 45,
  fuel_remaining: 580,
};

// ─── Fallback weather (when API is unavailable) ─

const FALLBACK_WEATHER: MarineWeather = {
  airTemp: 28.3, feelsLike: 31.2, waterTemp: 24.1, humidity: 82,
  pressure: 1013.2, visibility: 18, uvIndex: 7, cloudCover: 35,
  precipitation: 0, windSpeed: 15, windDir: "NE", windDeg: 45,
  windGust: 22, waveHeight: 1.2, wavePeriod: 8, waveDir: "NW",
  currentSpeed: 0.8, currentDir: "SE", seaState: "Marejadilla",
  beaufortScale: 4, douglasScale: 3, sunrise: "06:12", sunset: "18:24",
  description: "Parcialmente nublado", icon: "⛅",
};

const FALLBACK_FORECAST: WeatherForecast[] = [
  { hour: "Ahora", airTemp: 28, windSpeed: 15, windDir: "NE", waveHeight: 1.2, precipitation: 0, icon: "⛅", description: "Parcialmente nublado" },
  { hour: "+3h", airTemp: 29, windSpeed: 16, windDir: "NE", waveHeight: 1.3, precipitation: 0, icon: "☀️", description: "Despejado" },
  { hour: "+6h", airTemp: 30, windSpeed: 18, windDir: "ENE", waveHeight: 1.5, precipitation: 0, icon: "☀️", description: "Soleado" },
  { hour: "+12h", airTemp: 27, windSpeed: 22, windDir: "E", waveHeight: 1.8, precipitation: 0.5, icon: "🌥️", description: "Nubosidad" },
  { hour: "+18h", airTemp: 25, windSpeed: 20, windDir: "E", waveHeight: 1.6, precipitation: 1.2, icon: "🌧️", description: "Lluvias" },
  { hour: "+24h", airTemp: 26, windSpeed: 14, windDir: "NE", waveHeight: 1.0, precipitation: 0, icon: "⛅", description: "Mejorando" },
];

const FALLBACK_NOAA: NOAAData = {
  stationName: "Ref. Pacífico", stationId: "DEMO",
  tides: [
    { time: "02:15", height: 0.2, type: "low" },
    { time: "08:42", height: 1.8, type: "high" },
    { time: "14:30", height: 0.1, type: "low" },
    { time: "20:55", height: 1.9, type: "high" },
  ],
  waterLevel: 0.85, waterTemperature: 24.1, airPressure: 1013.2,
};

// ─── Hook ───────────────────────────────────────

export function useMaritimeData(): MaritimeData & { loading: boolean; error: string | null; refresh: () => void } {
  const [weather, setWeather] = useState<MarineWeather>(FALLBACK_WEATHER);
  const [forecast, setForecast] = useState<WeatherForecast[]>(FALLBACK_FORECAST);
  const [noaa, setNoaa] = useState<NOAAData>(FALLBACK_NOAA);
  const [dataSource, setDataSource] = useState<MaritimeData["dataSource"]>({ weather: "demo", tides: "demo", ais: "demo" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vessel, setVessel] = useState<AISVessel>(DEMO_VESSEL);

  const loadRealData = async () => {
    setLoading(true);
    setError(null);
    const newSources = { ...dataSource };

    try {
      // 1) Fetch real OpenWeatherMap data for vessel position
      const owmResult = await fetchMarineWeather(DEMO_VESSEL.lat, DEMO_VESSEL.lon);
      if (owmResult) {
        const waveHeight = estimateWaveHeight(owmResult.current.windSpeed);
        setWeather({
          airTemp: owmResult.current.airTemp,
          feelsLike: owmResult.current.feelsLike,
          waterTemp: owmResult.current.airTemp - 4, // Approximate sea temp
          humidity: owmResult.current.humidity,
          pressure: owmResult.current.pressure,
          visibility: owmResult.current.visibility,
          uvIndex: Math.min(Math.round(owmResult.current.airTemp / 4), 11), // Estimate
          cloudCover: owmResult.current.cloudCover,
          precipitation: 0,
          windSpeed: owmResult.current.windSpeed,
          windDir: owmResult.windDir,
          windDeg: owmResult.current.windDeg,
          windGust: owmResult.current.windGust,
          waveHeight,
          wavePeriod: Math.round(6 + owmResult.current.windSpeed / 10), // Estimate
          waveDir: degToCompass((owmResult.current.windDeg + 180) % 360), // Waves oppose wind
          currentSpeed: +(owmResult.current.windSpeed * 0.03).toFixed(1), // ~3% of wind
          currentDir: degToCompass((owmResult.current.windDeg + 90) % 360),
          seaState: beaufortToSeaState(owmResult.beaufort),
          beaufortScale: owmResult.beaufort,
          douglasScale: beaufortToDouglas(owmResult.beaufort),
          sunrise: owmResult.current.sunrise,
          sunset: owmResult.current.sunset,
          description: owmResult.current.description,
          icon: owmResult.current.icon,
        });

        setForecast(owmResult.forecast.slice(0, 6).map((f, i) => ({
          hour: i === 0 ? "Ahora" : `+${(i + 1) * 3}h`,
          airTemp: f.airTemp,
          windSpeed: f.windSpeed,
          windDir: degToCompass(f.windDeg),
          waveHeight: estimateWaveHeight(f.windSpeed),
          precipitation: f.precipitation,
          icon: f.icon,
          description: f.description,
        })));

        newSources.weather = "live";
      }
    } catch {
      console.warn("[Maritime] Weather API fallback to demo data");
    }

    try {
      // 2) Fetch NOAA tides (US station: San Francisco for demo)
      const noaaResult = await fetchNOAATides("9414290");
      if (noaaResult && noaaResult.tides.length > 0) {
        setNoaa({
          stationName: noaaResult.stationName,
          stationId: noaaResult.stationId,
          tides: noaaResult.tides,
          waterLevel: noaaResult.waterLevel ?? 0.85,
          waterTemperature: 24.1,
          airPressure: 1013.2,
        });
        newSources.tides = "live";
      }
    } catch {
      console.warn("[Maritime] NOAA API fallback to demo data");
    }

    setDataSource(newSources);
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    // biome-ignore lint: initial data load
    loadRealData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live vessel drift simulation (AIS demo)
  useEffect(() => {
    const interval = setInterval(() => {
      setVessel((prev) => ({
        ...prev,
        sog: +(prev.sog + (Math.random() - 0.5) * 0.3).toFixed(1),
        heading: Math.round(prev.heading + (Math.random() - 0.5) * 0.5),
        lastUpdate: new Date().toISOString(),
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Refresh weather every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => { loadRealData(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    vessel,
    track: DEMO_TRACK,
    nearbyVessels: DEMO_NEARBY,
    weather,
    forecast,
    noaa,
    route: DEMO_ROUTE,
    progress: DEMO_PROGRESS,
    dataSource,
    loading,
    error,
    refresh: loadRealData,
  };
}
