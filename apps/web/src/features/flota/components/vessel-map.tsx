"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Map, { Source, Layer, Marker, Popup, NavigationControl, ScaleControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation, Anchor, Clock, Compass,
  Ship, Waves, Locate, Wind,
  Thermometer, Ruler, Fuel, MoreHorizontal,
  Cloud, Eye, Gauge, Droplets,
  Sun, ArrowDown,
} from "lucide-react";

// ── Demo Navigation Data ─────────────────────────

const ROUTE_WAYPOINTS = [
  { name: "Manta", lat: -0.9537, lon: -80.7339, status: "departed" as const, arrived: "2026-03-16 08:00" },
  { name: "Guayaquil", lat: -2.1894, lon: -79.8891, status: "next" as const, eta: "2026-03-20 14:00" },
  { name: "Canal de Panamá", lat: 8.9500, lon: -79.5667, status: "pending" as const, eta: "2026-03-25 06:00" },
  { name: "Cartagena", lat: 10.3910, lon: -75.5144, status: "pending" as const, eta: "2026-03-27 18:00" },
  { name: "Houston", lat: 29.7604, lon: -95.3698, status: "pending" as const, eta: "2026-04-02 08:00" },
];

const VESSEL = {
  lat: -1.5200,
  lon: -80.2100,
  heading: 195,
  sog: 12.4,       // Speed Over Ground (knots)
  cog: 195,        // Course Over Ground (degrees)
  depth: 1850,     // meters
  windSpeed: 15,   // knots
  windDir: "NE",
  waveHeight: 1.2, // meters
  seaState: "Calma",
  waterTemp: 24,   // °C
  draft: 8.5,      // meters (calado)
  fuelRate: 12.5,  // tons/day
  name: "MV Grixi Pacífico",
  imo: "9876543",
  mmsi: "735000123",
  flag: "🇪🇨",
  type: "Tanquero Químico",
};

const ROUTE_PROGRESS = {
  pct: 6,
  traveled: 180,
  remaining: 2670,
  totalNm: 2850,
  eta: "2026-04-02",
};

// ── Marine Weather Data (simulated — replace with OpenWeatherMap API) ──

const MARINE_WEATHER = {
  airTemp: 28,
  waterTemp: 24,
  humidity: 82,
  pressure: 1013.2,
  visibility: 18, // km
  uvIndex: 7,
  cloudCover: 35,
  precipitation: 0,
  windSpeed: 15,
  windDir: "NE",
  windGust: 22,
  waveHeight: 1.2,
  wavePeriod: 8, // seconds
  waveDir: "NW",
  currentSpeed: 0.8, // knots
  currentDir: "SE",
  seaState: "Calma (Douglas 3)",
  sunrise: "06:12",
  sunset: "18:24",
  // NOAA Tides (simulated — replace with NOAA API)
  tides: [
    { time: "02:15", height: 0.2, type: "low" as const },
    { time: "08:42", height: 1.8, type: "high" as const },
    { time: "14:30", height: 0.1, type: "low" as const },
    { time: "20:55", height: 1.9, type: "high" as const },
  ],
  forecast: [
    { hour: "Now", wind: 15, wave: 1.2, icon: "☀️" },
    { hour: "+6h", wind: 18, wave: 1.5, icon: "⛅" },
    { hour: "+12h", wind: 22, wave: 1.8, icon: "🌥️" },
    { hour: "+18h", wind: 16, wave: 1.3, icon: "☀️" },
    { hour: "+24h", wind: 12, wave: 0.9, icon: "☀️" },
  ],
};

// GeoJSON for the full planned route
const routeGeoJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { type: "planned" },
      geometry: {
        type: "LineString",
        coordinates: ROUTE_WAYPOINTS.map((wp) => [wp.lon, wp.lat]),
      },
    },
    {
      type: "Feature",
      properties: { type: "traveled" },
      geometry: {
        type: "LineString",
        coordinates: [
          [ROUTE_WAYPOINTS[0].lon, ROUTE_WAYPOINTS[0].lat],
          [VESSEL.lon, VESSEL.lat],
        ],
      },
    },
  ],
};

// CartoDB Dark Matter — free dark ocean tiles
const MAP_STYLE = {
  version: 8 as const,
  name: "Maritime Dark",
  sources: {
    carto: {
      type: "raster" as const,
      tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
      tileSize: 256,
      attribution: "&copy; CARTO &copy; OpenStreetMap",
    },
  },
  layers: [
    {
      id: "carto-tiles",
      type: "raster" as const,
      source: "carto",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

type VesselMapProps = {
  vesselName?: string;
  compact?: boolean;
};

export function VesselMap({ compact = false }: VesselMapProps) {
  const mapRef = useRef(null);
  const [popupInfo, setPopupInfo] = useState<typeof ROUTE_WAYPOINTS[0] | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showWindy, setShowWindy] = useState(false);
  const [pulseScale, setPulseScale] = useState(1);

  // Animated pulse for vessel marker
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale((s) => (s >= 1.5 ? 1 : s + 0.02));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const onPortClick = useCallback((wp: typeof ROUTE_WAYPOINTS[0]) => {
    setPopupInfo(popupInfo?.name === wp.name ? null : wp);
  }, [popupInfo]);

  const height = compact ? "h-[420px]" : "h-[550px]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${height} rounded-xl overflow-hidden border border-[var(--border)]`}
    >
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -80,
          latitude: 10,
          zoom: 3.5,
          pitch: 0,
          bearing: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
      >
        {/* Navigation Controls */}
        <NavigationControl position="top-right" showCompass showZoom />
        <ScaleControl position="bottom-right" unit="nautical" />

        {/* Route Lines */}
        <Source id="route" type="geojson" data={routeGeoJSON}>
          {/* Planned route — dashed */}
          <Layer
            id="planned-route"
            type="line"
            filter={["==", ["get", "type"], "planned"]}
            paint={{
              "line-color": "rgba(14, 165, 233, 0.4)",
              "line-width": 2,
              "line-dasharray": [4, 3],
            }}
          />
          {/* Traveled route — solid */}
          <Layer
            id="traveled-route"
            type="line"
            filter={["==", ["get", "type"], "traveled"]}
            paint={{
              "line-color": "#10B981",
              "line-width": 3,
            }}
          />
        </Source>

        {/* Port Markers */}
        {ROUTE_WAYPOINTS.map((wp) => (
          <Marker
            key={wp.name}
            longitude={wp.lon}
            latitude={wp.lat}
            anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); onPortClick(wp); }}
          >
            <div className="group cursor-pointer flex flex-col items-center">
              <div
                className={`rounded-full border-2 transition-transform group-hover:scale-125 ${
                  wp.status === "departed"
                    ? "bg-[#10B981] border-[#10B981]/50 h-3 w-3"
                    : wp.status === "next"
                    ? "bg-[#0EA5E9] border-[#0EA5E9]/50 h-3.5 w-3.5 animate-pulse"
                    : "bg-[#64748b] border-[#64748b]/50 h-2.5 w-2.5"
                }`}
              />
              <span className={`mt-1 text-[9px] font-medium whitespace-nowrap ${
                wp.status === "next" ? "text-[#0EA5E9]" : "text-white/50"
              }`}>
                {wp.name}
              </span>
            </div>
          </Marker>
        ))}

        {/* Vessel Marker */}
        <Marker longitude={VESSEL.lon} latitude={VESSEL.lat} anchor="center">
          <div className="relative flex items-center justify-center">
            {/* Outer pulse ring */}
            <div
              className="absolute rounded-full bg-[#0EA5E9]/15 border border-[#0EA5E9]/30"
              style={{
                width: `${32 * pulseScale}px`,
                height: `${32 * pulseScale}px`,
                opacity: 2 - pulseScale,
              }}
            />
            {/* Direction arrow */}
            <div
              className="relative z-10"
              style={{ transform: `rotate(${VESSEL.heading}deg)` }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28">
                <defs>
                  <filter id="vessel-glow">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#0EA5E9" floodOpacity="0.6" />
                  </filter>
                </defs>
                <path
                  d="M14 2 L8 22 L14 17 L20 22 Z"
                  fill="#0EA5E9"
                  stroke="white"
                  strokeWidth="1"
                  filter="url(#vessel-glow)"
                />
              </svg>
            </div>
          </div>
        </Marker>

        {/* Port Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lon}
            latitude={popupInfo.lat}
            anchor="bottom"
            closeOnClick={false}
            onClose={() => setPopupInfo(null)}
            className="[&_.maplibregl-popup-content]:bg-[#0c1e3a]/95 [&_.maplibregl-popup-content]:backdrop-blur-xl [&_.maplibregl-popup-content]:border [&_.maplibregl-popup-content]:border-white/10 [&_.maplibregl-popup-content]:rounded-xl [&_.maplibregl-popup-content]:p-3 [&_.maplibregl-popup-content]:text-white [&_.maplibregl-popup-close-button]:text-white/50 [&_.maplibregl-popup-close-button]:hover:text-white [&_.maplibregl-popup-tip]:border-t-[#0c1e3a]/95"
          >
            <div className="min-w-[150px]">
              <div className="flex items-center gap-2 mb-2">
                <Anchor size={12} className="text-[#0EA5E9]" />
                <span className="text-[11px] font-bold">{popupInfo.name}</span>
                <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase ${
                  popupInfo.status === "departed" ? "bg-[#10B981]/20 text-[#10B981]" :
                  popupInfo.status === "next" ? "bg-[#0EA5E9]/20 text-[#0EA5E9]" :
                  "bg-white/10 text-white/50"
                }`}>
                  {popupInfo.status === "departed" ? "Zarpó" : popupInfo.status === "next" ? "Siguiente" : "Pendiente"}
                </span>
              </div>
              <div className="space-y-1 text-[9px] text-white/60">
                <p>📍 {popupInfo.lat.toFixed(4)}°, {popupInfo.lon.toFixed(4)}°</p>
                {"eta" in popupInfo && popupInfo.eta && <p>🕐 ETA: {popupInfo.eta}</p>}
                {"arrived" in popupInfo && popupInfo.arrived && <p>✅ Llegada: {popupInfo.arrived}</p>}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* ── HUD: Vessel Info Card (Top-Left) ── */}
      <div className="absolute top-3 left-3 z-20 rounded-xl border border-white/10 bg-[#0c1e3a]/90 backdrop-blur-xl p-3 shadow-2xl max-w-[220px]">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
          <Ship size={14} className="text-[#0EA5E9]" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-white truncate">{VESSEL.name}</p>
            <p className="text-[8px] text-white/40">{VESSEL.flag} {VESSEL.type} · IMO {VESSEL.imo}</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse shrink-0" />
        </div>

        {/* Primary nav data */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            { icon: Navigation, label: "COG", value: `${VESSEL.cog}°`, color: "#0EA5E9" },
            { icon: Waves, label: "SOG", value: `${VESSEL.sog} kn`, color: "#10B981" },
            { icon: Compass, label: "Lat", value: `${Math.abs(VESSEL.lat).toFixed(4)}°S`, color: "#8B5CF6" },
            { icon: Locate, label: "Lon", value: `${Math.abs(VESSEL.lon).toFixed(4)}°W`, color: "#8B5CF6" },
            { icon: Anchor, label: "Destino", value: "Guayaquil", color: "#F59E0B" },
            { icon: Clock, label: "ETA", value: "20 Mar 14:00", color: "#F59E0B" },
          ].map((info) => (
            <div key={info.label} className="flex items-center gap-1.5">
              <info.icon size={9} style={{ color: info.color, opacity: 0.7 }} className="shrink-0" />
              <div>
                <p className="text-[6px] font-bold text-white/30 uppercase tracking-wider">{info.label}</p>
                <p className="text-[10px] font-bold text-white/90">{info.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-2 w-full flex items-center justify-center gap-1 rounded-md bg-white/5 hover:bg-white/10 py-1 text-[8px] text-white/40 transition-colors"
        >
          <MoreHorizontal size={10} />
          {showDetails ? "Ocultar" : "Más datos"}
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 pt-2 border-t border-white/10">
                {[
                  { icon: Ruler, label: "Profundidad", value: `${VESSEL.depth}m` },
                  { icon: Ruler, label: "Calado", value: `${VESSEL.draft}m` },
                  { icon: Wind, label: "Viento", value: `${VESSEL.windSpeed}kn ${VESSEL.windDir}` },
                  { icon: Waves, label: "Oleaje", value: `${VESSEL.waveHeight}m` },
                  { icon: Thermometer, label: "Temp. Agua", value: `${VESSEL.waterTemp}°C` },
                  { icon: Fuel, label: "Consumo", value: `${VESSEL.fuelRate} t/d` },
                ].map((info) => (
                  <div key={info.label} className="flex items-center gap-1.5">
                    <info.icon size={9} className="text-white/30 shrink-0" />
                    <div>
                      <p className="text-[6px] font-bold text-white/30 uppercase tracking-wider">{info.label}</p>
                      <p className="text-[10px] font-bold text-white/90">{info.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Layer Toggles (Top-Right below nav controls) ── */}
      <div className="absolute top-24 right-3 z-20 flex flex-col gap-1">
        {[
          { id: "weather", label: "Clima", icon: Cloud, active: showWeather, onClick: () => setShowWeather(!showWeather) },
          { id: "windy", label: "Windy", icon: Wind, active: showWindy, onClick: () => setShowWindy(!showWindy) },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={btn.onClick}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-bold backdrop-blur-md transition-all ${
              btn.active
                ? "border-[#0EA5E9]/50 bg-[#0EA5E9]/20 text-[#0EA5E9]"
                : "border-white/10 bg-[#0c1e3a]/80 text-white/50 hover:text-white/70"
            }`}
          >
            <btn.icon size={11} />
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── Windy Weather Embed Overlay ── */}
      <AnimatePresence>
        {showWindy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10"
          >
            <iframe
              title="Windy Weather"
              width="100%"
              height="100%"
              src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=kt&zoom=5&overlay=wind&product=ecmwf&level=surface&lat=${VESSEL.lat}&lon=${VESSEL.lon}&detailLat=${VESSEL.lat}&detailLon=${VESSEL.lon}&marker=true&message=true`}
              frameBorder="0"
              className="rounded-xl"
            />
            <button
              onClick={() => setShowWindy(false)}
              className="absolute top-3 left-3 z-30 rounded-lg border border-white/20 bg-[#0c1e3a]/90 backdrop-blur-xl px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#0c1e3a] transition-colors"
            >
              ✕ Cerrar Windy
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Marine Weather Panel (Bottom-Left) ── */}
      <AnimatePresence>
        {showWeather && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-14 left-3 z-20 w-[320px] rounded-xl border border-white/10 bg-[#0c1e3a]/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="px-3 pt-3 pb-2 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud size={12} className="text-[#0EA5E9]" />
                  <span className="text-[10px] font-bold text-[#0EA5E9] uppercase tracking-wider">Condiciones Marítimas</span>
                </div>
                <span className="text-[8px] text-white/30">OpenWeatherMap · NOAA</span>
              </div>
            </div>

            {/* Weather grid */}
            <div className="grid grid-cols-3 gap-2 p-3">
              {[
                { icon: Wind, label: "Viento", value: `${MARINE_WEATHER.windSpeed}kt ${MARINE_WEATHER.windDir}`, color: "#0EA5E9" },
                { icon: Waves, label: "Oleaje", value: `${MARINE_WEATHER.waveHeight}m / ${MARINE_WEATHER.wavePeriod}s`, color: "#06B6D4" },
                { icon: Thermometer, label: "Aire", value: `${MARINE_WEATHER.airTemp}°C`, color: "#F59E0B" },
                { icon: Droplets, label: "Agua", value: `${MARINE_WEATHER.waterTemp}°C`, color: "#3B82F6" },
                { icon: Gauge, label: "Presión", value: `${MARINE_WEATHER.pressure} hPa`, color: "#8B5CF6" },
                { icon: Eye, label: "Visibilidad", value: `${MARINE_WEATHER.visibility} km`, color: "#10B981" },
                { icon: Droplets, label: "Humedad", value: `${MARINE_WEATHER.humidity}%`, color: "#06B6D4" },
                { icon: Sun, label: "UV", value: `${MARINE_WEATHER.uvIndex} Alto`, color: "#EF4444" },
                { icon: ArrowDown, label: "Corriente", value: `${MARINE_WEATHER.currentSpeed}kt ${MARINE_WEATHER.currentDir}`, color: "#F97316" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-white/5 p-2">
                  <item.icon size={10} style={{ color: item.color }} className="mb-1" />
                  <p className="text-[8px] text-white/40">{item.label}</p>
                  <p className="text-[10px] font-bold text-white/90">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Forecast row */}
            <div className="px-3 pb-2">
              <p className="text-[8px] font-bold text-white/30 uppercase tracking-wider mb-1">Pronóstico 24h</p>
              <div className="flex gap-1">
                {MARINE_WEATHER.forecast.map((f) => (
                  <div key={f.hour} className="flex-1 rounded-md bg-white/5 p-1.5 text-center">
                    <p className="text-[7px] text-white/40">{f.hour}</p>
                    <p className="text-[11px] my-0.5">{f.icon}</p>
                    <p className="text-[8px] text-[#0EA5E9]">{f.wind}kt</p>
                    <p className="text-[7px] text-white/40">{f.wave}m</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tides */}
            <div className="px-3 pb-3">
              <p className="text-[8px] font-bold text-white/30 uppercase tracking-wider mb-1">Mareas — NOAA</p>
              <div className="flex gap-2">
                {MARINE_WEATHER.tides.map((t) => (
                  <div key={t.time} className="flex items-center gap-1">
                    <span className={`text-[8px] ${t.type === "high" ? "text-[#0EA5E9]" : "text-[#F59E0B]"}`}>
                      {t.type === "high" ? "▲" : "▼"}
                    </span>
                    <div>
                      <p className="text-[8px] text-white/70">{t.time}</p>
                      <p className="text-[7px] text-white/40">{t.height}m</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[7px] text-white/30">
                <span>☀️ {MARINE_WEATHER.sunrise}</span>
                <span>{MARINE_WEATHER.seaState}</span>
                <span>🌅 {MARINE_WEATHER.sunset}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD: Route Progress Bar (Bottom) ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-[#0c1e3a]/90 backdrop-blur-xl border-t border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="shrink-0 min-w-[130px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold uppercase tracking-wider text-white/40">Ruta — {ROUTE_PROGRESS.totalNm} nm</span>
              <span className="text-[9px] font-bold text-[#0EA5E9]">{ROUTE_PROGRESS.pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#10B981] to-[#0EA5E9] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${ROUTE_PROGRESS.pct}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[7px] text-white/30">{ROUTE_PROGRESS.traveled} nm</span>
              <span className="text-[7px] text-white/30">{ROUTE_PROGRESS.remaining} nm</span>
            </div>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-white/10 shrink-0" />

          {/* Waypoints horizontal */}
          <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
            {ROUTE_WAYPOINTS.map((wp, i) => (
              <button
                key={wp.name}
                onClick={() => onPortClick(wp)}
                className={`flex items-center gap-1 shrink-0 rounded-lg px-2 py-1 transition-colors text-[9px] font-medium ${
                  popupInfo?.name === wp.name
                    ? "bg-[#0EA5E9]/20 text-[#0EA5E9]"
                    : "hover:bg-white/5 text-white/50"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  wp.status === "departed" ? "bg-[#10B981]" :
                  wp.status === "next" ? "bg-[#0EA5E9] animate-pulse" :
                  "bg-white/20"
                }`} />
                {wp.name}
                {i < ROUTE_WAYPOINTS.length - 1 && (
                  <span className="text-white/15 ml-0.5">→</span>
                )}
              </button>
            ))}
          </div>

          {/* Sea state badge */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="text-right">
              <p className="text-[7px] text-white/30 uppercase font-bold">Estado del Mar</p>
              <p className="text-[10px] font-bold text-[#10B981]">{VESSEL.seaState}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
