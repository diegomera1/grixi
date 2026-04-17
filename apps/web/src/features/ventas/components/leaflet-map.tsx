"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  Tooltip as LeafletTooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SalesCustomer, SalesInvoice } from "../types";
import { fmtMoneyCompact } from "../utils/fmtMoney";

// ── Types ─────────────────────────────────────────

type DrillLevel = "world" | "country" | "province" | "city";

type CountryAgg = {
  country: string;
  revenue: number;
  clients: number;
  lat: number;
  lng: number;
};

type ProvinceAgg = {
  province: string;
  revenue: number;
  clients: number;
  lat: number;
  lng: number;
  customerList: SalesCustomer[];
};

type Props = {
  customers: SalesCustomer[];
  invoices: SalesInvoice[];
  onCountrySelect: (country: string | null) => void;
  onProvinceSelect: (province: string | null) => void;
  selectedCountry: string | null;
  selectedProvince: string | null;
  onClientSelect?: (client: SalesCustomer) => void;
};

// ── Country bounding boxes ────────────────────────

const COUNTRY_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  Ecuador: [[-5.0, -81.1], [1.5, -75.2]],
  Colombia: [[-4.2, -79.0], [12.5, -67.0]],
  Peru: [[-18.3, -81.3], [-0.04, -68.7]],
  Brazil: [[-33.7, -73.9], [5.3, -34.8]],
  Chile: [[-56.0, -75.6], [-17.5, -66.9]],
  Argentina: [[-55.1, -73.6], [-21.8, -53.6]],
  Mexico: [[-14.5, -118.4], [32.7, -86.7]],
  "United States": [[24.4, -125.0], [49.4, -66.9]],
  Germany: [[47.3, 5.9], [55.1, 15.0]],
  Spain: [[36.0, -9.3], [43.8, 3.3]],
  Panama: [[7.2, -83.1], [9.6, -77.2]],
  "Costa Rica": [[8.0, -86.0], [11.2, -82.5]],
  Guatemala: [[13.7, -92.2], [17.8, -88.2]],
  Honduras: [[12.9, -89.4], [16.5, -83.1]],
  Bolivia: [[-22.9, -69.6], [-9.7, -57.5]],
  Paraguay: [[-27.6, -62.6], [-19.3, -54.3]],
  Uruguay: [[-35.0, -58.4], [-30.1, -53.1]],
  Venezuela: [[0.6, -73.4], [12.2, -59.8]],
  Canada: [[41.7, -141.0], [83.1, -52.6]],
  France: [[41.4, -5.1], [51.1, 9.6]],
  Italy: [[36.6, 6.6], [47.1, 18.5]],
  "United Kingdom": [[49.9, -8.2], [58.7, 1.8]],
  India: [[6.7, 68.2], [35.5, 97.4]],
  China: [[18.2, 73.7], [53.6, 134.8]],
  Japan: [[24.4, 123.7], [45.5, 145.8]],
  Australia: [[-43.6, 113.3], [-10.7, 153.6]],
  Netherlands: [[50.8, 3.4], [53.5, 7.2]],
  Portugal: [[36.8, -9.5], [42.2, -6.2]],
};

// ── Province GeoJSON ──────────────────────────────

const PROVINCE_GEO_URLS: Record<string, string> = {
  Ecuador: "https://cdn.jsdelivr.net/gh/pabl-o-ce/Ecuador-geoJSON@master/geojson/provinces.geojson",
};

const PROVINCE_NAME_KEYS: Record<string, string[]> = {
  Ecuador: ["DPA_DESPRO", "name", "NAME", "NOMBRE"],
};

// ── Country flags emoji ───────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  Ecuador: "🇪🇨", Colombia: "🇨🇴", Peru: "🇵🇪", Brazil: "🇧🇷",
  Chile: "🇨🇱", Argentina: "🇦🇷", Mexico: "🇲🇽", "United States": "🇺🇸",
  Germany: "🇩🇪", Spain: "🇪🇸", Panama: "🇵🇦", France: "🇫🇷",
  Italy: "🇮🇹", "United Kingdom": "🇬🇧", India: "🇮🇳", China: "🇨🇳",
  Japan: "🇯🇵", Australia: "🇦🇺", Canada: "🇨🇦", Netherlands: "🇳🇱",
  Portugal: "🇵🇹", Venezuela: "🇻🇪", "Costa Rica": "🇨🇷",
  Guatemala: "🇬🇹", Honduras: "🇭🇳", Bolivia: "🇧🇴",
  Paraguay: "🇵🇾", Uruguay: "🇺🇾",
};

// ── Helpers ───────────────────────────────────────

// Use centralized formatter
const fmtUSD = fmtMoneyCompact;

function getHeatColor(ratio: number): string {
  if (ratio > 0.7) return "#10b981";
  if (ratio > 0.4) return "#06b6d4";
  if (ratio > 0.15) return "#3b82f6";
  return "#8b5cf6";
}

function getProvinceChromaColor(ratio: number): string {
  if (ratio > 0.7) return "#059669";
  if (ratio > 0.4) return "#0d9488";
  if (ratio > 0.15) return "#0284c7";
  return "#6366f1";
}

// ── Custom DivIcon for glowing markers ────────────

function createGlowIcon(
  revenue: number,
  maxRev: number,
  label: string,
  flag?: string,
  size: "lg" | "md" | "sm" = "lg"
): L.DivIcon {
  const ratio = maxRev > 0 ? revenue / maxRev : 0;
  const color = getHeatColor(ratio);
  const baseSize = size === "lg" ? 14 : size === "md" ? 10 : 7;
  const r = Math.max(baseSize, Math.min(baseSize + 18, ratio * (baseSize + 22) + baseSize));
  const glowSize = r * 2.5;
  const displayLabel = flag ? `${flag} ${label}` : label;

  return L.divIcon({
    className: "grixi-glow-marker",
    iconSize: [glowSize, glowSize],
    iconAnchor: [glowSize / 2, glowSize / 2],
    html: `
      <div style="position:relative;width:${glowSize}px;height:${glowSize}px;display:flex;align-items:center;justify-content:center">
        <div class="grixi-glow-ring" style="
          position:absolute;width:${glowSize}px;height:${glowSize}px;
          border-radius:50%;
          background:radial-gradient(circle, ${color}33 0%, ${color}11 50%, transparent 70%);
          animation:grixi-pulse 3s ease-in-out infinite;
        "></div>
        <div style="
          position:relative;z-index:2;
          width:${r}px;height:${r}px;
          border-radius:50%;
          background:radial-gradient(circle at 35% 35%, ${color}ee, ${color}99);
          border:2px solid ${color};
          box-shadow:0 0 ${r * 0.6}px ${color}66, 0 0 ${r * 1.2}px ${color}22;
        "></div>
        ${size !== "sm" ? `<div style="
          position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);
          white-space:nowrap;font-size:${size === "lg" ? 11 : 9}px;font-weight:700;
          color:#e2e8f0;text-shadow:0 1px 4px rgba(0,0,0,0.8),0 0 8px rgba(0,0,0,0.6);
          font-family:system-ui,-apple-system,sans-serif;letter-spacing:-0.02em;
        ">${displayLabel}</div>` : ""}
        <div style="
          position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          font-size:${size === "lg" ? 9 : 7}px;font-weight:800;color:#fff;
          text-shadow:0 1px 3px rgba(0,0,0,0.5);z-index:3;
          font-family:system-ui,-apple-system,sans-serif;
        ">${fmtUSD(revenue)}</div>
      </div>
    `,
  });
}

// ── Map Controller ────────────────────────────────

function MapController({
  selectedCountry,
  drillLevel,
  provinceCenter,
  cityCenter,
}: {
  selectedCountry: string | null;
  drillLevel: DrillLevel;
  provinceCenter: [number, number] | null;
  cityCenter: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (drillLevel === "world") {
      map.flyTo([5, -55], 3, { duration: 0.8 });
    } else if (drillLevel === "city" && cityCenter) {
      map.flyTo(cityCenter, 13, { duration: 0.8 });
    } else if (drillLevel === "province" && provinceCenter) {
      map.flyTo(provinceCenter, 9, { duration: 0.8 });
    } else if (drillLevel === "country" && selectedCountry) {
      const bounds = COUNTRY_BOUNDS[selectedCountry];
      if (bounds) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8, maxZoom: 7 });
      }
    }
  }, [map, selectedCountry, drillLevel, provinceCenter, cityCenter]);

  return null;
}

// ── Province GeoJSON Layer (native Leaflet API) ───

function ProvinceLayer({
  country,
  provinceData,
  onProvinceClick,
}: {
  country: string;
  provinceData: Map<string, ProvinceAgg>;
  onProvinceClick: (name: string) => void;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  // Refs to avoid stale closures in GeoJSON event handlers
  const onClickRef = useRef(onProvinceClick);
  const provDataRef = useRef(provinceData);
  onClickRef.current = onProvinceClick;
  provDataRef.current = provinceData;

  const getProvName = useCallback(
    (props: Record<string, unknown>): string => {
      const keys = PROVINCE_NAME_KEYS[country] || ["name", "NAME"];
      for (const k of keys) {
        if (props[k]) return String(props[k]);
      }
      for (const v of Object.values(props)) {
        if (typeof v === "string" && v.length > 1 && v.length < 40) return v;
      }
      return "Desconocido";
    },
    [country]
  );

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const findProvDataFresh = (geoName: string): ProvinceAgg | null => {
    const pData = provDataRef.current;
    const needle = normalize(geoName);
    for (const [key, val] of pData.entries()) {
      const nk = normalize(key);
      if (nk === needle || nk.includes(needle) || needle.includes(nk)) return val;
    }
    return null;
  };

  // Fetch GeoJSON — only when country changes
  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const url = PROVINCE_GEO_URLS[country];
    if (!url) return;

    let cancelled = false;

    fetch(url)
      .then((r) => r.json())
      .then((geoData: GeoJSON.FeatureCollection) => {
        if (cancelled) return;

        const layer = L.geoJSON(geoData, {
          style: (feature) => {
            if (!feature) return {};
            const name = getProvName(feature.properties || {});
            const data = findProvDataFresh(name);
            const pData = provDataRef.current;
            const maxRev = Math.max(...Array.from(pData.values()).map((v) => v.revenue), 1);
            const hasData = !!data;
            const ratio = hasData ? data.revenue / maxRev : 0;
            return {
              fillColor: hasData ? getProvinceChromaColor(ratio) : "#1e293b",
              fillOpacity: hasData ? 0.45 + ratio * 0.25 : 0.08,
              color: hasData ? "#38bdf8" : "#334155",
              weight: hasData ? 1.8 : 0.8,
              opacity: hasData ? 0.7 : 0.3,
            };
          },
          onEachFeature: (feature, featureLayer) => {
            const name = getProvName(feature.properties || {});
            const data = findProvDataFresh(name);

            featureLayer.bindTooltip(
              `<div class="grixi-tooltip-inner">
                <div class="grixi-tooltip-title">${name}</div>
                ${
                  data
                    ? `<div class="grixi-tooltip-row"><span>Revenue</span><b class="text-emerald">${fmtUSD(data.revenue)}</b></div>
                       <div class="grixi-tooltip-row"><span>Clientes</span><b class="text-blue">${data.clients}</b></div>`
                    : `<div class="grixi-tooltip-empty">Sin datos de clientes</div>`
                }
                <div class="grixi-tooltip-hint">Click para explorar →</div>
              </div>`,
              { sticky: true, className: "grixi-map-tooltip", direction: "top", offset: [0, -10] }
            );

            (featureLayer as L.Path).on({
              mouseover: (e) => {
                const t = e.target as L.Path;
                t.setStyle({ fillOpacity: 0.75, weight: 2.5, color: "#60a5fa" });
                t.bringToFront();
              },
              mouseout: () => {
                if (layerRef.current) layerRef.current.resetStyle(featureLayer as L.Path);
              },
              // Use ref so click always has fresh callback
              click: () => onClickRef.current(name),
            });
          },
        });

        layer.addTo(map);
        layerRef.current = layer;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  // Only re-fetch when country changes — callbacks use refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, country, getProvName]);

  return null;
}

// ═══════════════════════════════════════════════════
// Main Leaflet Map Component
// ═══════════════════════════════════════════════════

export function LeafletMap({
  customers,
  invoices,
  onCountrySelect,
  onProvinceSelect,
  selectedCountry,
  selectedProvince,
  onClientSelect,
}: Props) {
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("world");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [streetViewCustomer, setStreetViewCustomer] = useState<{ name: string; lat: number; lng: number } | null>(null);

  // ── Aggregate by country ────────────────────
  const { countryAgg, maxCountryRev } = useMemo(() => {
    const map = new Map<string, { revenue: number; clients: number; lats: number[]; lngs: number[] }>();

    for (const c of customers) {
      const cur = map.get(c.country) || { revenue: 0, clients: 0, lats: [], lngs: [] };
      cur.revenue += Number(c.total_revenue || 0);
      cur.clients += 1;
      if (c.lat != null && c.lng != null) {
        cur.lats.push(c.lat);
        cur.lngs.push(c.lng);
      }
      map.set(c.country, cur);
    }

    const arr: CountryAgg[] = [];
    let maxRev = 1;
    for (const [country, data] of map) {
      if (data.revenue > maxRev) maxRev = data.revenue;
      arr.push({
        country,
        revenue: data.revenue,
        clients: data.clients,
        lat: data.lats.length > 0 ? data.lats.reduce((a, b) => a + b, 0) / data.lats.length : 0,
        lng: data.lngs.length > 0 ? data.lngs.reduce((a, b) => a + b, 0) / data.lngs.length : 0,
      });
    }

    return { countryAgg: arr.filter((c) => c.lat !== 0 && c.lng !== 0), maxCountryRev: maxRev };
  }, [customers]);

  // ── Aggregate by province ───────────────────
  const provinceData = useMemo(() => {
    if (!selectedCountry) return new Map<string, ProvinceAgg>();
    const map = new Map<string, ProvinceAgg>();
    for (const c of customers) {
      if (c.country !== selectedCountry) continue;
      const prov = c.province || "Sin Provincia";
      const cur = map.get(prov) || { province: prov, revenue: 0, clients: 0, lat: 0, lng: 0, customerList: [] };
      cur.revenue += Number(c.total_revenue || 0);
      cur.clients += 1;
      cur.customerList.push(c);
      if (c.lat != null && c.lng != null && cur.lat === 0) {
        cur.lat = c.lat;
        cur.lng = c.lng;
      }
      map.set(prov, cur);
    }
    return map;
  }, [customers, selectedCountry]);

  const maxProvRev = useMemo(() => {
    let max = 1;
    for (const v of provinceData.values()) {
      if (v.revenue > max) max = v.revenue;
    }
    return max;
  }, [provinceData]);

  // ── City markers ────────────────────────────
  const cityMarkers = useMemo(() => {
    if (!selectedProvince || !selectedCountry) return [];
    const map = new Map<string, { revenue: number; clients: number; lat: number; lng: number }>();
    for (const c of customers) {
      if (c.country !== selectedCountry || (c.province || "Sin Provincia") !== selectedProvince) continue;
      const city = c.city || "Sin Ciudad";
      const cur = map.get(city) || { revenue: 0, clients: 0, lat: 0, lng: 0 };
      cur.revenue += Number(c.total_revenue || 0);
      cur.clients += 1;
      if (c.lat != null && c.lng != null && cur.lat === 0) {
        cur.lat = c.lat;
        cur.lng = c.lng;
      }
      map.set(city, cur);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter((c) => c.lat !== 0 && c.lng !== 0);
  }, [customers, selectedCountry, selectedProvince]);

  const maxCityRev = useMemo(() => Math.max(...cityMarkers.map((c) => c.revenue), 1), [cityMarkers]);

  // ── Individual customer markers for city view ──
  const customerMarkers = useMemo(() => {
    if (!selectedCity || !selectedProvince || !selectedCountry) return [];
    return customers.filter((c) => {
      if (c.country !== selectedCountry) return false;
      if ((c.province || "Sin Provincia") !== selectedProvince) return false;
      if ((c.city || "Sin Ciudad") !== selectedCity) return false;
      return c.lat != null && c.lng != null && c.lat !== 0 && c.lng !== 0;
    });
  }, [customers, selectedCountry, selectedProvince, selectedCity]);

  const maxCustomerRev = useMemo(
    () => Math.max(...customerMarkers.map((c) => Number(c.total_revenue || 0)), 1),
    [customerMarkers]
  );

  // ── Handlers ────────────────────────────────
  const handleCountryClick = useCallback(
    (country: string) => {
      setDrillLevel("country");
      setSelectedCity(null);
      onCountrySelect(country);
      onProvinceSelect(null);
    },
    [onCountrySelect, onProvinceSelect]
  );

  const handleProvinceClick = useCallback(
    (province: string) => {
      setDrillLevel("province");
      setSelectedCity(null);
      onProvinceSelect(province);
    },
    [onProvinceSelect]
  );

  const handleCityClick = useCallback(
    (cityName: string) => {
      setSelectedCity(cityName);
      setDrillLevel("city");
    },
    []
  );

  // Sync drill level when parent resets
  useEffect(() => {
    if (!selectedCountry) { setDrillLevel("world"); setSelectedCity(null); }
    else if (!selectedProvince) { setDrillLevel("country"); setSelectedCity(null); }
    else if (!selectedCity) setDrillLevel("province");
    else setDrillLevel("city");
  }, [selectedCountry, selectedProvince, selectedCity]);

  const hasProvGeo = selectedCountry ? !!PROVINCE_GEO_URLS[selectedCountry] : false;

  // Province center for zoom
  const provinceCenter = useMemo((): [number, number] | null => {
    if (!selectedProvince) return null;
    const prov = provinceData.get(selectedProvince);
    if (prov && prov.lat !== 0 && prov.lng !== 0) return [prov.lat, prov.lng];
    return null;
  }, [selectedProvince, provinceData]);

  // City center for zoom
  const cityCenter = useMemo((): [number, number] | null => {
    if (!selectedCity) return null;
    const cm = cityMarkers.find((c) => c.name === selectedCity);
    if (cm) return [cm.lat, cm.lng];
    return null;
  }, [selectedCity, cityMarkers]);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      {/* Theme-aware map styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes grixi-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.3; }
        }
        .grixi-glow-marker { background: transparent !important; border: none !important; }
        .grixi-map-tooltip {
          background: ${isDark ? 'rgba(8, 12, 24, 0.75)' : 'rgba(255, 255, 255, 0.92)'} !important;
          border: 1px solid ${isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0, 0, 0, 0.08)'} !important;
          border-radius: 14px !important;
          padding: 0 !important;
          color: ${isDark ? '#e2e8f0' : '#1e293b'} !important;
          box-shadow: 0 8px 40px ${isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.1)'}, 0 0 24px ${isDark ? 'rgba(56,189,248,0.06)' : 'rgba(0,0,0,0.02)'}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)'} !important;
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
        }
        .grixi-map-tooltip::before {
          border-top-color: ${isDark ? 'rgba(8, 12, 24, 0.75)' : 'rgba(255, 255, 255, 0.92)'} !important;
        }
        .grixi-tooltip-inner { padding: 10px 14px; min-width: 150px; }
        .grixi-tooltip-title { font-weight: 700; font-size: 13px; color: ${isDark ? '#f1f5f9' : '#0f172a'}; margin-bottom: 6px; letter-spacing: -0.02em; }
        .grixi-tooltip-row { font-size: 11px; color: ${isDark ? '#94a3b8' : '#64748b'}; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 3px; }
        .grixi-tooltip-row .text-emerald { color: #34d399; font-weight: 700; }
        .grixi-tooltip-row .text-blue { color: #60a5fa; font-weight: 700; }
        .grixi-tooltip-empty { font-size: 10px; color: ${isDark ? '#475569' : '#94a3b8'}; font-style: italic; }
        .grixi-tooltip-hint { font-size: 9px; color: #38bdf8; margin-top: 6px; opacity: 0.7; }
        .leaflet-container {
          background: ${isDark ? '#070b14' : '#f1f5f9'} !important;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .leaflet-popup-content-wrapper {
          background: ${isDark ? 'rgba(8, 12, 24, 0.72)' : 'rgba(255, 255, 255, 0.92)'} !important;
          border: 1px solid ${isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 0, 0, 0.08)'} !important;
          border-radius: 16px !important;
          color: ${isDark ? '#e2e8f0' : '#1e293b'} !important;
          box-shadow: 0 16px 56px ${isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.12)'}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)'} !important;
          backdrop-filter: blur(24px) saturate(1.5);
          -webkit-backdrop-filter: blur(24px) saturate(1.5);
        }
        .leaflet-popup-tip { background: ${isDark ? 'rgba(8, 12, 24, 0.72)' : 'rgba(255, 255, 255, 0.92)'} !important; }
        .leaflet-popup-close-button { color: ${isDark ? '#64748b' : '#94a3b8'} !important; font-size: 16px !important; }
        .leaflet-control-zoom a {
          background: ${isDark ? 'rgba(10, 15, 30, 0.85)' : 'rgba(255, 255, 255, 0.9)'} !important;
          color: ${isDark ? '#94a3b8' : '#475569'} !important;
          border-color: ${isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 0, 0, 0.1)'} !important;
          font-size: 14px !important;
        }
        .leaflet-control-zoom a:hover {
          background: ${isDark ? 'rgba(20, 30, 50, 0.95)' : 'rgba(240, 245, 255, 1)'} !important;
          color: ${isDark ? '#e2e8f0' : '#1e293b'} !important;
        }
        .leaflet-control-attribution {
          background: ${isDark ? 'rgba(10, 15, 30, 0.6)' : 'rgba(255, 255, 255, 0.7)'} !important;
          color: ${isDark ? '#334155' : '#94a3b8'} !important;
          font-size: 8px !important;
        }
        .leaflet-control-attribution a { color: ${isDark ? '#475569' : '#64748b'} !important; }
      ` }} />

      <MapContainer
        center={[5, -55]}
        zoom={2}
        minZoom={2}
        maxZoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* Theme-aware tiles */}
        <TileLayer
          key={`base-${isDark ? 'dark' : 'light'}`}
          url={`https://{s}.basemaps.cartocdn.com/${isDark ? 'dark_nolabels' : 'light_nolabels'}/{z}/{x}/{y}{r}.png`}
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
        />
        {/* Labels overlay on top */}
        <TileLayer
          key={`labels-${isDark ? 'dark' : 'light'}`}
          url={`https://{s}.basemaps.cartocdn.com/${isDark ? 'dark_only_labels' : 'light_only_labels'}/{z}/{x}/{y}{r}.png`}
          attribution=""
          pane="shadowPane"
        />

        {/* Animated transitions */}
        <MapController selectedCountry={selectedCountry} drillLevel={drillLevel} provinceCenter={provinceCenter} cityCenter={cityCenter} />

        {/* Province GeoJSON boundaries */}
        {drillLevel !== "world" && selectedCountry && hasProvGeo && (
          <ProvinceLayer
            country={selectedCountry}
            provinceData={provinceData}
            onProvinceClick={handleProvinceClick}
          />
        )}

        {/* ── WORLD VIEW: Glowing country markers ── */}
        {drillLevel === "world" &&
          countryAgg.map((ca) => (
            <Marker
              key={ca.country}
              position={[ca.lat, ca.lng]}
              icon={createGlowIcon(ca.revenue, maxCountryRev, ca.country, COUNTRY_FLAGS[ca.country], "lg")}
              eventHandlers={{ click: () => handleCountryClick(ca.country) }}
            >
              <LeafletTooltip className="grixi-map-tooltip" direction="top" offset={[0, -25]}>
                <div className="grixi-tooltip-inner">
                  <div className="grixi-tooltip-title">
                    {COUNTRY_FLAGS[ca.country] || "📍"} {ca.country}
                  </div>
                  <div className="grixi-tooltip-row">
                    <span>Revenue</span>
                    <b className="text-emerald">{fmtUSD(ca.revenue)}</b>
                  </div>
                  <div className="grixi-tooltip-row">
                    <span>Clientes</span>
                    <b className="text-blue">{ca.clients}</b>
                  </div>
                  <div className="grixi-tooltip-hint">Click para explorar →</div>
                </div>
              </LeafletTooltip>
            </Marker>
          ))}

        {/* ── COUNTRY VIEW (no GeoJSON): Province markers ── */}
        {drillLevel === "country" && selectedCountry && !hasProvGeo &&
          Array.from(provinceData.values())
            .filter((p) => p.lat !== 0 && p.lng !== 0)
            .map((p) => (
              <Marker
                key={p.province}
                position={[p.lat, p.lng]}
                icon={createGlowIcon(p.revenue, maxProvRev, p.province, undefined, "md")}
                eventHandlers={{ click: () => handleProvinceClick(p.province) }}
              >
                <LeafletTooltip className="grixi-map-tooltip" direction="top" offset={[0, -18]}>
                  <div className="grixi-tooltip-inner">
                    <div className="grixi-tooltip-title">{p.province}</div>
                    <div className="grixi-tooltip-row">
                      <span>Revenue</span>
                      <b className="text-emerald">{fmtUSD(p.revenue)}</b>
                    </div>
                    <div className="grixi-tooltip-row">
                      <span>Clientes</span>
                      <b className="text-blue">{p.clients}</b>
                    </div>
                  </div>
                </LeafletTooltip>
              </Marker>
            ))}

        {/* ── COUNTRY VIEW (with GeoJSON): Province dot markers ── */}
        {(drillLevel === "province" || (drillLevel === "country" && hasProvGeo)) &&
          selectedCountry &&
          Array.from(provinceData.values())
            .filter((p) => p.lat !== 0 && p.lng !== 0 && (drillLevel === "country" || p.province === selectedProvince))
            .map((p) => (
              <Marker
                key={`prov-dot-${p.province}`}
                position={[p.lat, p.lng]}
                icon={createGlowIcon(
                  p.revenue,
                  maxProvRev,
                  p.province,
                  undefined,
                  p.province === selectedProvince ? "md" : "sm"
                )}
                eventHandlers={{ click: () => handleProvinceClick(p.province) }}
              >
                <LeafletTooltip className="grixi-map-tooltip" direction="top" offset={[0, -14]}>
                  <div className="grixi-tooltip-inner">
                    <div className="grixi-tooltip-title">{p.province}</div>
                    <div className="grixi-tooltip-row">
                      <span>Revenue</span>
                      <b className="text-emerald">{fmtUSD(p.revenue)}</b>
                    </div>
                    <div className="grixi-tooltip-row">
                      <span>Clientes</span>
                      <b className="text-blue">{p.clients}</b>
                    </div>
                  </div>
                </LeafletTooltip>
              </Marker>
            ))}

        {/* ── PROVINCE VIEW: City markers ── */}
        {drillLevel === "province" &&
          cityMarkers.map((cm) => (
            <Marker
              key={`city-${cm.name}`}
              position={[cm.lat, cm.lng]}
              icon={createGlowIcon(cm.revenue, maxCityRev, cm.name, "📍", "md")}
              eventHandlers={{ click: () => handleCityClick(cm.name) }}
            >
              <LeafletTooltip className="grixi-map-tooltip" direction="top" offset={[0, -18]}>
                <div className="grixi-tooltip-inner">
                  <div className="grixi-tooltip-title">📍 {cm.name}</div>
                  <div className="grixi-tooltip-row">
                    <span>Revenue</span>
                    <b className="text-emerald">{fmtUSD(cm.revenue)}</b>
                  </div>
                  <div className="grixi-tooltip-row">
                    <span>Clientes</span>
                    <b className="text-blue">{cm.clients}</b>
                  </div>
                  <div className="grixi-tooltip-hint">Click para ver clientes →</div>
                </div>
              </LeafletTooltip>
            </Marker>
          ))}

        {/* ── CITY VIEW: Individual customer markers ── */}
        {drillLevel === "city" &&
          customerMarkers.map((cust) => {
            const rev = Number(cust.total_revenue || 0);
            return (
              <Marker
                key={`cust-${cust.id}`}
                position={[cust.lat!, cust.lng!]}
                icon={createGlowIcon(rev, maxCustomerRev, cust.business_name, "🏢", "md")}
                eventHandlers={{
                  click: () => {
                    if (onClientSelect) {
                      // Bidirectional: inform parent, side panel handles street view
                      const fullCustomer = customers.find((c) => c.id === cust.id);
                      if (fullCustomer) onClientSelect(fullCustomer);
                    } else if (cust.lat != null && cust.lng != null) {
                      // Fallback: internal street view overlay
                      setStreetViewCustomer({ name: cust.business_name, lat: cust.lat, lng: cust.lng });
                    }
                  },
                }}
              >
                <LeafletTooltip className="grixi-map-tooltip" direction="top" offset={[0, -18]}>
                  <div className="grixi-tooltip-inner">
                    <div className="grixi-tooltip-title">🏢 {cust.business_name}</div>
                    <div className="grixi-tooltip-row">
                      <span>Revenue</span>
                      <b className="text-emerald">{fmtUSD(rev)}</b>
                    </div>
                    <div className="grixi-tooltip-row">
                      <span>Segmento</span>
                      <b className="text-blue">{cust.segment}</b>
                    </div>
                    <div className="grixi-tooltip-row">
                      <span>Ciudad</span>
                      <b>{cust.city}</b>
                    </div>
                    <div className="grixi-tooltip-hint">🗺️ Click para ver Street View →</div>
                  </div>
                </LeafletTooltip>
              </Marker>
            );
          })}
      </MapContainer>

      {/* ── Embedded Street View Overlay ── */}
      {streetViewCustomer && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 1100,
          display: "flex", flexDirection: "column",
          background: "#070b14",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {/* Header bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px",
            background: "rgba(8,12,24,0.9)",
            borderBottom: "1px solid rgba(56,189,248,0.15)",
            backdropFilter: "blur(12px)",
          }}>
            <button
              onClick={() => setStreetViewCustomer(null)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid rgba(56,189,248,0.2)",
                background: "rgba(56,189,248,0.08)",
                color: "#38bdf8",
                fontWeight: 600,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "system-ui, -apple-system, sans-serif",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "rgba(56,189,248,0.15)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "rgba(56,189,248,0.08)"; }}
            >
              ← Volver al mapa
            </button>
            <div style={{ flex: 1 }} />
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 14 }}>🏢</span>
              <span style={{
                color: "#f1f5f9", fontWeight: 700, fontSize: 12,
                fontFamily: "system-ui, -apple-system, sans-serif",
                letterSpacing: "-0.02em",
              }}>
                {streetViewCustomer.name}
              </span>
              <span style={{
                color: "#64748b", fontSize: 10,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}>
                — Street View
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{
              color: "#475569", fontSize: 9,
              fontFamily: "monospace",
            }}>
              {streetViewCustomer.lat.toFixed(4)}, {streetViewCustomer.lng.toFixed(4)}
            </span>
          </div>
          {/* Street View iframe */}
          <iframe
            src={`https://maps.google.com/maps?q=&layer=c&cbll=${streetViewCustomer.lat},${streetViewCustomer.lng}&cbp=12,0,,0,0&output=svembed`}
            style={{
              flex: 1, width: "100%", border: "none",
            }}
            allowFullScreen
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 28, left: 12, zIndex: 1000,
        background: "rgba(10,15,30,0.85)", backdropFilter: "blur(12px)",
        border: "1px solid rgba(56,189,248,0.15)", borderRadius: 10,
        padding: "8px 12px", display: "flex", gap: 10, alignItems: "center",
      }}>
        {[
          { color: "#8b5cf6", label: "< 15%" },
          { color: "#3b82f6", label: "15-40%" },
          { color: "#06b6d4", label: "40-70%" },
          { color: "#10b981", label: "> 70%" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: l.color, boxShadow: `0 0 6px ${l.color}66`,
            }} />
            <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "system-ui" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
