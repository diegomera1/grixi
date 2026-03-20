"use client";

import { useState, useEffect, useCallback } from "react";

// ─── MarineTraffic AIS Types ────────────────────

export type AISVessel = {
  mmsi: string;
  imo: string;
  name: string;
  type: string;
  flag: string;
  lat: number;
  lon: number;
  heading: number;
  sog: number; // Speed Over Ground (knots)
  cog: number; // Course Over Ground (degrees)
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

// ─── OpenWeatherMap Marine Types ─────────────────

export type MarineWeather = {
  airTemp: number;
  feelsLike: number;
  waterTemp: number;
  humidity: number;
  pressure: number;
  visibility: number; // km
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

// ─── NOAA Tides Types ───────────────────────────

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

// ─── Route Types ────────────────────────────────

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

// ─── Combined Maritime Data ─────────────────────

export type MaritimeData = {
  vessel: AISVessel;
  track: AISTrackPoint[];
  nearbyVessels: NearbyVessel[];
  weather: MarineWeather;
  forecast: WeatherForecast[];
  noaa: NOAAData;
  route: RouteWaypoint[];
  progress: RouteProgress;
};

// ─── Realistic Demo Data ────────────────────────
// Based on real MarineTraffic, OpenWeatherMap & NOAA API response formats

const DEMO_DATA: MaritimeData = {
  vessel: {
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
    lastUpdate: "2026-03-20T05:58:00Z",
  },

  track: [
    { lat: -0.9537, lon: -80.7339, timestamp: "2026-03-16T08:00:00Z", sog: 0, cog: 0 },
    { lat: -1.0100, lon: -80.6800, timestamp: "2026-03-16T10:00:00Z", sog: 8.2, cog: 160 },
    { lat: -1.0800, lon: -80.5900, timestamp: "2026-03-16T14:00:00Z", sog: 10.1, cog: 170 },
    { lat: -1.1500, lon: -80.5200, timestamp: "2026-03-17T02:00:00Z", sog: 11.5, cog: 175 },
    { lat: -1.2200, lon: -80.4500, timestamp: "2026-03-17T12:00:00Z", sog: 12.0, cog: 180 },
    { lat: -1.3000, lon: -80.3800, timestamp: "2026-03-18T00:00:00Z", sog: 12.3, cog: 185 },
    { lat: -1.3800, lon: -80.3200, timestamp: "2026-03-18T12:00:00Z", sog: 12.4, cog: 190 },
    { lat: -1.4500, lon: -80.2600, timestamp: "2026-03-19T06:00:00Z", sog: 12.1, cog: 192 },
    { lat: -1.5200, lon: -80.2100, timestamp: "2026-03-20T05:58:00Z", sog: 12.4, cog: 195 },
  ],

  nearbyVessels: [
    { mmsi: "369970815", name: "STENA VISION", type: "Tanker", lat: -1.48, lon: -80.35, sog: 10.2, distance_nm: 8.5, bearing: 290 },
    { mmsi: "244780000", name: "CAPE SOUNIO", type: "Bulk Carrier", lat: -1.60, lon: -80.10, sog: 11.8, distance_nm: 6.2, bearing: 155 },
    { mmsi: "538006769", name: "PACIFIC TRADER", type: "Container Ship", lat: -1.35, lon: -80.30, sog: 14.5, distance_nm: 12.1, bearing: 340 },
    { mmsi: "352001234", name: "DON JULIO", type: "Fishing Vessel", lat: -1.55, lon: -80.25, sog: 3.1, distance_nm: 2.8, bearing: 220 },
    { mmsi: "735091234", name: "ISLA PUNÁ", type: "Tug", lat: -2.10, lon: -79.95, sog: 8.0, distance_nm: 40.2, bearing: 175 },
  ],

  weather: {
    airTemp: 28.3,
    feelsLike: 31.2,
    waterTemp: 24.1,
    humidity: 82,
    pressure: 1013.2,
    visibility: 18,
    uvIndex: 7,
    cloudCover: 35,
    precipitation: 0,
    windSpeed: 15,
    windDir: "NE",
    windDeg: 45,
    windGust: 22,
    waveHeight: 1.2,
    wavePeriod: 8,
    waveDir: "NW",
    currentSpeed: 0.8,
    currentDir: "SE",
    seaState: "Slight",
    beaufortScale: 4,
    douglasScale: 3,
    sunrise: "06:12",
    sunset: "18:24",
    description: "Parcialmente nublado",
    icon: "⛅",
  },

  forecast: [
    { hour: "Ahora", airTemp: 28, windSpeed: 15, windDir: "NE", waveHeight: 1.2, precipitation: 0, icon: "⛅", description: "Parcialmente nublado" },
    { hour: "+3h", airTemp: 29, windSpeed: 16, windDir: "NE", waveHeight: 1.3, precipitation: 0, icon: "☀️", description: "Despejado" },
    { hour: "+6h", airTemp: 30, windSpeed: 18, windDir: "ENE", waveHeight: 1.5, precipitation: 0, icon: "☀️", description: "Soleado" },
    { hour: "+12h", airTemp: 27, windSpeed: 22, windDir: "E", waveHeight: 1.8, precipitation: 0.5, icon: "🌥️", description: "Nubosidad creciente" },
    { hour: "+18h", airTemp: 25, windSpeed: 20, windDir: "E", waveHeight: 1.6, precipitation: 1.2, icon: "🌧️", description: "Lluvias dispersas" },
    { hour: "+24h", airTemp: 26, windSpeed: 14, windDir: "NE", waveHeight: 1.0, precipitation: 0, icon: "⛅", description: "Mejorando" },
  ],

  noaa: {
    stationName: "La Libertad, Ecuador",
    stationId: "ECLL01",
    tides: [
      { time: "02:15", height: 0.2, type: "low" },
      { time: "08:42", height: 1.8, type: "high" },
      { time: "14:30", height: 0.1, type: "low" },
      { time: "20:55", height: 1.9, type: "high" },
    ],
    waterLevel: 0.85,
    waterTemperature: 24.1,
    airPressure: 1013.2,
  },

  route: [
    { name: "Manta", lat: -0.9537, lon: -80.7339, status: "departed", arrived: "2026-03-16 08:00", port_code: "ECMEC", berth: "Muelle A-3" },
    { name: "En Ruta", lat: -1.5200, lon: -80.2100, status: "current" },
    { name: "Guayaquil", lat: -2.1894, lon: -79.8891, status: "next", eta: "2026-03-20 19:00", port_code: "ECGYE", berth: "Terminal Portuario TPG" },
    { name: "Canal de Panamá", lat: 8.9500, lon: -79.5667, status: "pending", eta: "2026-03-25 06:00", port_code: "PACNL" },
    { name: "Cartagena", lat: 10.3910, lon: -75.5144, status: "pending", eta: "2026-03-27 18:00", port_code: "COCTG", berth: "Sociedad Portuaria" },
    { name: "Houston", lat: 29.7604, lon: -95.3698, status: "pending", eta: "2026-04-02 08:00", port_code: "USHOU", berth: "Port of Houston T-49" },
  ],

  progress: {
    pct: 6,
    traveled_nm: 180,
    remaining_nm: 2670,
    total_nm: 2850,
    eta_final: "2026-04-02T08:00:00Z",
    avg_speed: 11.8,
    fuel_consumed: 45,
    fuel_remaining: 580,
  },
};

// ─── Hook ───────────────────────────────────────

export function useMaritimeData(): MaritimeData & { loading: boolean; refresh: () => void } {
  const [data, setData] = useState<MaritimeData>(DEMO_DATA);
  const [loading, setLoading] = useState(false);

  // Simulate slight data drift for "live" feel
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => ({
        ...prev,
        vessel: {
          ...prev.vessel,
          sog: +(prev.vessel.sog + (Math.random() - 0.5) * 0.2).toFixed(1),
          heading: Math.round(prev.vessel.heading + (Math.random() - 0.5) * 0.5),
          lastUpdate: new Date().toISOString(),
        },
        weather: {
          ...prev.weather,
          windSpeed: +(prev.weather.windSpeed + (Math.random() - 0.5) * 0.5).toFixed(0),
          waveHeight: +(prev.weather.waveHeight + (Math.random() - 0.5) * 0.05).toFixed(2),
          airTemp: +(prev.weather.airTemp + (Math.random() - 0.5) * 0.1).toFixed(1),
        },
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setData(DEMO_DATA);
      setLoading(false);
    }, 800);
  }, []);

  return { ...data, loading, refresh };
}
