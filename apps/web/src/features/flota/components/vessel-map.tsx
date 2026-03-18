"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Maximize2, Minimize2, Navigation, Anchor,
  Clock, MapPin, Compass,
} from "lucide-react";

// Demo route: Manta → Guayaquil → Balboa → Cartagena → Houston
const ROUTE_WAYPOINTS = [
  { name: "Manta", lat: -0.9537, lon: -80.7339 },
  { name: "Guayaquil", lat: -2.1894, lon: -79.8891 },
  { name: "Canal de Panamá (Balboa)", lat: 8.9500, lon: -79.5667 },
  { name: "Cartagena", lat: 10.3910, lon: -75.5144 },
  { name: "Houston", lat: 29.7604, lon: -95.3698 },
];

const VESSEL_POSITION = { lat: -1.5200, lon: -80.2100 };
const VESSEL_HEADING = 195;
const VESSEL_SPEED = 12.4;

const CESIUM_ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiYzQ0NDI0Zi1jOWNkLTRkYmUtYTc0ZS1kYzg2NWZiN2E3OGYiLCJpZCI6NDA1Mzg3LCJpYXQiOjE3NzM4MDA2NDh9.v1kGitn2z629Zudc6y3vws8uDkgeifH84XqPnEXDmgU";

type VesselMapProps = {
  vesselName?: string;
  compact?: boolean;
};

// Load CesiumJS from CDN
function loadCesiumCDN(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as unknown as Record<string, unknown>).Cesium) {
      resolve();
      return;
    }

    // Load CSS
    if (!document.getElementById("cesium-css")) {
      const link = document.createElement("link");
      link.id = "cesium-css";
      link.rel = "stylesheet";
      link.href = "https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Widgets/widgets.css";
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement("script");
    script.src = "https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Cesium.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load CesiumJS"));
    document.head.appendChild(script);
  });
}

export function VesselMap({ vesselName = "MV Grixi Pacífico", compact = false }: VesselMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const createVesselIcon = useCallback((): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.shadowColor = "#0EA5E9";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#0EA5E9";
    ctx.beginPath();
    ctx.arc(16, 16, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    return canvas.toDataURL();
  }, []);

  useEffect(() => {
    if (!mapRef.current || viewerRef.current) return;

    const initMap = async () => {
      try {
        await loadCesiumCDN();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Cesium = (window as any).Cesium;

        Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

        const viewer = new Cesium.Viewer(mapRef.current!, {
          terrain: Cesium.Terrain.fromWorldTerrain(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          animation: false,
          fullscreenButton: false,
          navigationHelpButton: false,
          infoBox: false,
          creditContainer: document.createElement("div"),
        });

        viewer.scene.globe.enableLighting = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled = true;

        // Vessel marker
        viewer.entities.add({
          name: vesselName,
          position: Cesium.Cartesian3.fromDegrees(VESSEL_POSITION.lon, VESSEL_POSITION.lat, 0),
          billboard: {
            image: createVesselIcon(),
            width: 32,
            height: 32,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
          },
          label: {
            text: vesselName,
            font: "11px Inter, sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#0EA5E9"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -22),
          },
        });

        // Planned route (dashed)
        const routePositions = ROUTE_WAYPOINTS.map((wp) =>
          Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 100)
        );
        viewer.entities.add({
          polyline: {
            positions: routePositions,
            width: 2,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString("#0EA5E9").withAlpha(0.6),
              dashLength: 16,
            }),
            clampToGround: true,
          },
        });

        // Traveled route (solid green)
        viewer.entities.add({
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(ROUTE_WAYPOINTS[0].lon, ROUTE_WAYPOINTS[0].lat, 100),
              Cesium.Cartesian3.fromDegrees(VESSEL_POSITION.lon, VESSEL_POSITION.lat, 100),
            ],
            width: 3,
            material: Cesium.Color.fromCssColorString("#10B981").withAlpha(0.8),
            clampToGround: true,
          },
        });

        // Port markers
        ROUTE_WAYPOINTS.forEach((wp) => {
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 0),
            point: { pixelSize: 6, color: Cesium.Color.fromCssColorString("#F59E0B"), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
            label: {
              text: wp.name,
              font: "10px Inter, sans-serif",
              fillColor: Cesium.Color.fromCssColorString("#F59E0B"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -10),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
            },
          });
        });

        // Fly to vessel
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(VESSEL_POSITION.lon, VESSEL_POSITION.lat, 3000000),
          duration: 2,
        });

        viewerRef.current = viewer;
        setMapLoaded(true);
      } catch (err) {
        console.error("[CesiumJS]", err);
        setLoadError(true);
      }
    };

    initMap();

    return () => {
      if (viewerRef.current && typeof (viewerRef.current as { destroy: () => void }).destroy === "function") {
        (viewerRef.current as { destroy: () => void }).destroy();
        viewerRef.current = null;
      }
    };
  }, [vesselName, createVesselIcon]);

  const height = compact ? "h-[300px]" : isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-[450px]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${height} rounded-xl overflow-hidden border border-[#0EA5E9]/20 bg-[#030712]`}
    >
      <div ref={mapRef} className="h-full w-full" style={{ position: "relative" }} />

      {/* Loading */}
      {!mapLoaded && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712]/90 z-10">
          <div className="h-8 w-8 rounded-full border-2 border-[#0EA5E9] border-t-transparent animate-spin" />
          <p className="mt-3 text-xs text-[#0EA5E9]/60">Cargando mapa CesiumJS Globe...</p>
          <p className="mt-1 text-[9px] text-white/30">Descargando terreno y texturas</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#030712] z-10">
          <MapPin size={32} className="text-[#0EA5E9]/30" />
          <p className="mt-2 text-xs text-[var(--text-muted)]">No se pudo cargar CesiumJS</p>
          <p className="text-[9px] text-[var(--text-muted)]">Requiere conexión a internet</p>
        </div>
      )}

      {/* HUD */}
      {mapLoaded && (
        <>
          <div className="absolute top-3 left-3 z-20 rounded-xl border border-white/10 bg-[#0a0f1a]/90 backdrop-blur-md p-3 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[10px] font-bold text-[#0EA5E9]">{vesselName}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { icon: Navigation, label: "Rumbo", value: `${VESSEL_HEADING}°` },
                { icon: Compass, label: "Velocidad", value: `${VESSEL_SPEED} kn` },
                { icon: MapPin, label: "Posición", value: `${Math.abs(VESSEL_POSITION.lat).toFixed(2)}°S ${Math.abs(VESSEL_POSITION.lon).toFixed(2)}°W` },
                { icon: Anchor, label: "Destino", value: "Guayaquil" },
                { icon: Clock, label: "ETA", value: "~18h" },
              ].map((info) => (
                <div key={info.label} className="flex items-center gap-1.5">
                  <info.icon size={9} className="text-white/30" />
                  <div>
                    <p className="text-[7px] text-white/30">{info.label}</p>
                    <p className="text-[10px] font-bold text-white/80">{info.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-3 left-3 z-20 rounded-lg border border-white/10 bg-[#0a0f1a]/90 backdrop-blur-md px-3 py-2">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Ruta</p>
            <div className="space-y-1">
              {ROUTE_WAYPOINTS.map((wp, i) => (
                <div key={wp.name} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
                  <span className="text-[9px] text-white/60">{wp.name}</span>
                </div>
              ))}
            </div>
          </div>

          {!compact && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="absolute top-3 right-3 z-20 rounded-lg border border-white/10 bg-[#0a0f1a]/80 p-2 text-white/60 hover:text-white transition-colors"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}
