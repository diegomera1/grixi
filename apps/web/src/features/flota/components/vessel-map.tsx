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

// Calculate route progress
function getRouteProgress(): { pct: number; distanceTraveled: string; distanceRemaining: string } {
  const totalNm = 2850;
  const traveledNm = 180;
  return {
    pct: Math.round((traveledNm / totalNm) * 100),
    distanceTraveled: `${traveledNm} nm`,
    distanceRemaining: `${totalNm - traveledNm} nm`,
  };
}

type VesselMapProps = {
  vesselName?: string;
  compact?: boolean;
};

// Load CesiumJS from CDN
function loadCesiumCDN(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).Cesium) {
      resolve();
      return;
    }

    if (!document.getElementById("cesium-css")) {
      const link = document.createElement("link");
      link.id = "cesium-css";
      link.rel = "stylesheet";
      link.href = "https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Widgets/widgets.css";
      document.head.appendChild(link);
    }

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
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext("2d")!;
    // Glow
    ctx.shadowColor = "#0EA5E9";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#0EA5E9";
    ctx.beginPath();
    ctx.arc(20, 20, 10, 0, Math.PI * 2);
    ctx.fill();
    // Inner white
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(20, 20, 5, 0, Math.PI * 2);
    ctx.fill();
    // Direction indicator (triangle pointing up → heading)
    ctx.fillStyle = "#0EA5E9";
    ctx.beginPath();
    ctx.moveTo(20, 4);
    ctx.lineTo(15, 12);
    ctx.lineTo(25, 12);
    ctx.closePath();
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

        // Globe styling
        viewer.scene.globe.enableLighting = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0c1a2e");
        viewer.scene.globe.undergroundColor = Cesium.Color.fromCssColorString("#060d18");
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 500;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 20000000;

        // Vessel marker with direction arrow and pulsing ring
        viewer.entities.add({
          name: vesselName,
          position: Cesium.Cartesian3.fromDegrees(VESSEL_POSITION.lon, VESSEL_POSITION.lat, 0),
          billboard: {
            image: createVesselIcon(),
            width: 40,
            height: 40,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            rotation: Cesium.Math.toRadians(-VESSEL_HEADING),
          },
          label: {
            text: vesselName,
            font: "bold 13px Inter, sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -26),
          },
          ellipse: {
            semiMajorAxis: 10000,
            semiMinorAxis: 10000,
            material: Cesium.Color.fromCssColorString("#0EA5E9").withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#0EA5E9").withAlpha(0.5),
            outlineWidth: 2,
          },
        });

        // Planned route (blue dashed)
        const routePositions = ROUTE_WAYPOINTS.map((wp) =>
          Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 100)
        );
        viewer.entities.add({
          polyline: {
            positions: routePositions,
            width: 2.5,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.fromCssColorString("#0EA5E9").withAlpha(0.5),
              dashLength: 16,
            }),
            clampToGround: true,
          },
        });

        // Traveled route (solid emerald)
        viewer.entities.add({
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(ROUTE_WAYPOINTS[0].lon, ROUTE_WAYPOINTS[0].lat, 100),
              Cesium.Cartesian3.fromDegrees(VESSEL_POSITION.lon, VESSEL_POSITION.lat, 100),
            ],
            width: 4,
            material: Cesium.Color.fromCssColorString("#10B981"),
            clampToGround: true,
          },
        });

        // Port markers
        ROUTE_WAYPOINTS.forEach((wp, i) => {
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 0),
            point: {
              pixelSize: i === 0 ? 10 : 7,
              color: Cesium.Color.fromCssColorString(i === 0 ? "#10B981" : "#F59E0B"),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
            },
            label: {
              text: wp.name,
              font: "bold 11px Inter, sans-serif",
              fillColor: Cesium.Color.fromCssColorString(i === 0 ? "#10B981" : "#F59E0B"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -14),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
            },
          });
        });

        // Initial camera fly
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(VESSEL_POSITION.lon, VESSEL_POSITION.lat, 800000),
          orientation: {
            heading: Cesium.Math.toRadians(10),
            pitch: Cesium.Math.toRadians(-35),
            roll: 0,
          },
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

  const flyToPort = useCallback((lat: number, lon: number) => {
    if (!viewerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Cesium = (window as any).Cesium;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewerRef.current as any).camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, 200000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
      duration: 1.5,
    });
  }, []);

  const flyToVessel = useCallback(() => {
    if (!viewerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Cesium = (window as any).Cesium;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewerRef.current as any).camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(VESSEL_POSITION.lon, VESSEL_POSITION.lat, 400000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-35), roll: 0 },
      duration: 1.5,
    });
  }, []);

  const progress = getRouteProgress();

  const height = compact ? "h-[350px]" : isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-[500px]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${height} rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)]`}
    >
      <div ref={mapRef} className="h-full w-full" style={{ position: "relative" }} />

      {/* Loading */}
      {!mapLoaded && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-surface)] z-10">
          <div className="h-10 w-10 rounded-full border-2 border-[#0EA5E9] border-t-transparent animate-spin" />
          <p className="mt-3 text-xs text-[#0EA5E9]/60 font-medium">Cargando mapa CesiumJS Globe...</p>
          <p className="mt-1 text-[9px] text-[var(--text-muted)]">Descargando terreno y texturas</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-surface)] z-10">
          <MapPin size={32} className="text-[var(--text-muted)]" />
          <p className="mt-2 text-xs text-[var(--text-muted)]">No se pudo cargar CesiumJS</p>
          <p className="text-[9px] text-[var(--text-muted)]">Requiere conexión a internet</p>
        </div>
      )}

      {/* HUD Overlays */}
      {mapLoaded && (
        <>
          {/* Top-left: Vessel info card */}
          <div className="absolute top-3 left-3 z-20 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-xl p-3 shadow-lg min-w-[210px]">
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-[var(--border)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-[11px] font-bold text-[var(--text-primary)]">{vesselName}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              {[
                { icon: Navigation, label: "Rumbo", value: `${VESSEL_HEADING}°` },
                { icon: Compass, label: "Velocidad", value: `${VESSEL_SPEED} kn` },
                { icon: MapPin, label: "Posición", value: `${Math.abs(VESSEL_POSITION.lat).toFixed(2)}°S ${Math.abs(VESSEL_POSITION.lon).toFixed(2)}°W` },
                { icon: Anchor, label: "Destino", value: "Guayaquil" },
                { icon: Clock, label: "ETA", value: "~18h" },
              ].map((info) => (
                <div key={info.label} className="flex items-center gap-2">
                  <info.icon size={11} className="text-[var(--text-muted)] shrink-0" />
                  <div>
                    <p className="text-[7px] font-medium text-[var(--text-muted)] uppercase tracking-wider">{info.label}</p>
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">{info.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom-left: Route progress + ports */}
          <div className="absolute bottom-3 left-3 z-20 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-xl px-3 py-2.5 shadow-lg max-w-[200px]">
            <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Ruta · {progress.pct}%</p>
            <div className="w-full h-1.5 bg-[var(--bg-muted)] rounded-full mb-1.5 overflow-hidden">
              <div className="h-full bg-[#10B981] rounded-full transition-all" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="flex justify-between text-[8px] text-[var(--text-muted)] mb-2.5">
              <span>{progress.distanceTraveled}</span>
              <span>{progress.distanceRemaining}</span>
            </div>
            <div className="space-y-0.5">
              {ROUTE_WAYPOINTS.map((wp, i) => (
                <button
                  key={wp.name}
                  onClick={() => flyToPort(wp.lat, wp.lon)}
                  className="flex items-center gap-2 w-full text-left rounded-md px-1.5 py-1 hover:bg-[var(--bg-muted)] transition-colors group"
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${i === 0 ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
                  <span className="text-[10px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{wp.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Top-right: Controls */}
          {!compact && (
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]/90 backdrop-blur-md p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shadow-md"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={flyToVessel}
                className="rounded-lg border border-[#0EA5E9]/30 bg-[var(--bg-surface)]/90 backdrop-blur-md p-2 text-[#0EA5E9]/70 hover:text-[#0EA5E9] transition-colors shadow-md"
                title="Centrar en buque"
              >
                <Navigation size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
