"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as echarts from "echarts/core";
import { MapChart, EffectScatterChart, ScatterChart, BarChart as EBarChart, PieChart as EPieChart } from "echarts/charts";
import {
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
  TitleComponent,
  GridComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  Globe,
  MapPin,
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  X,
  FileText,
  Layers,
  ExternalLink,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SalesInvoice, SalesCustomer } from "../types";
import { SEGMENT_LABELS, SEGMENT_COLORS, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "../types";
import type { InvoiceStatus } from "../types";

// Register ECharts modules (tree-shakeable)
echarts.use([
  MapChart,
  EffectScatterChart,
  ScatterChart,
  EBarChart,
  EPieChart,
  GeoComponent,
  TooltipComponent,
  VisualMapComponent,
  TitleComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

// ── Types ─────────────────────────────────────────

type CountryData = {
  country: string;
  iso3: string;
  revenue: number;
  invoices: number;
  clients: SalesCustomer[];
  avgDealSize: number;
  topSegment: string;
};

type Props = {
  invoices: SalesInvoice[];
  customers: SalesCustomer[];
};

// ── Country name → GeoJSON name mapping ───────────
// ECharts uses the "name" property from the GeoJSON, which follows Natural Earth naming
const COUNTRY_NAME_TO_GEO: Record<string, string> = {
  Ecuador: "Ecuador",
  Germany: "Germany",
  Spain: "Spain",
  Brazil: "Brazil",
  "United States": "United States of America",
  Mexico: "Mexico",
  Colombia: "Colombia",
  Chile: "Chile",
  Peru: "Peru",
  Argentina: "Argentina",
  Panama: "Panama",
  "Costa Rica": "Costa Rica",
  Guatemala: "Guatemala",
  "Dominican Republic": "Dominican Rep.",
  Honduras: "Honduras",
  Paraguay: "Paraguay",
  Uruguay: "Uruguay",
  Bolivia: "Bolivia",
  Venezuela: "Venezuela",
  Canada: "Canada",
  France: "France",
  Italy: "Italy",
  "United Kingdom": "United Kingdom",
  China: "China",
  Japan: "Japan",
  India: "India",
  Australia: "Australia",
  Netherlands: "Netherlands",
  Portugal: "Portugal",
  Poland: "Poland",
  "South Korea": "South Korea",
  Indonesia: "Indonesia",
  Thailand: "Thailand",
  Russia: "Russia",
};

// Country center coordinates [lng, lat] for effectScatter markers
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Ecuador: [-78.18, -1.83],
  Germany: [10.45, 51.16],
  Spain: [-3.75, 40.46],
  Brazil: [-51.93, -14.24],
  "United States": [-95.71, 37.09],
  Mexico: [-102.55, 23.63],
  Colombia: [-74.3, 4.57],
  Chile: [-71.54, -35.68],
  Peru: [-75.02, -9.19],
  Argentina: [-63.62, -38.42],
  Panama: [-80.78, 8.54],
  "Costa Rica": [-84.09, 9.75],
  Guatemala: [-90.23, 15.78],
  "Dominican Republic": [-70.16, 18.74],
  Honduras: [-86.24, 14.64],
  Paraguay: [-58.44, -23.44],
  Uruguay: [-55.77, -32.52],
  Bolivia: [-63.59, -16.29],
  Venezuela: [-66.59, 6.42],
  Canada: [-106.35, 56.13],
  France: [2.21, 46.23],
  Italy: [12.57, 41.87],
  "United Kingdom": [-3.44, 55.38],
  China: [104.2, 35.86],
  Japan: [138.25, 36.2],
  India: [78.96, 20.59],
  Australia: [133.78, -25.27],
  Netherlands: [5.29, 52.13],
  Portugal: [-8.22, 39.4],
  Poland: [19.15, 51.92],
  "South Korea": [127.77, 35.91],
  Indonesia: [113.92, -0.79],
  Thailand: [100.99, 15.87],
  Russia: [105.32, 61.52],
};

// ── Theme-aware colors ────────────────────────────

function useThemeColors() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return useMemo(
    () => ({
      isDark,
      mapBg: isDark ? "#0f1729" : "#f0f4f8",
      areaColor: isDark ? "#1a2332" : "#dbeafe",
      areaHover: isDark ? "#2563EB" : "#3B82F6",
      borderColor: isDark ? "rgba(100,116,139,0.25)" : "rgba(148,163,184,0.4)",
      labelColor: isDark ? "#fff" : "#1e293b",
      scatterLabelColor: isDark ? "rgba(226,232,240,0.8)" : "rgba(30,41,59,0.9)",
      tooltipBg: isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.97)",
      tooltipBorder: isDark ? "rgba(148,163,184,0.2)" : "rgba(203,213,225,0.5)",
      tooltipText: isDark ? "#e2e8f0" : "#1e293b",
      tooltipSub: isDark ? "#94a3b8" : "#64748b",
      visualMapColors: isDark
        ? ["#1a2332", "#1E3A5F", "#2563EB", "#3B82F6", "#06B6D4", "#10B981"]
        : ["#dbeafe", "#93c5fd", "#3B82F6", "#2563EB", "#0891b2", "#059669"],
      cardBg: isDark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.7)",
    }),
    [isDark]
  );
}

// ── Main Component ────────────────────────────────

export function WorldHeatmap({ invoices, customers }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const theme = useThemeColors();

  // ── Aggregate data by country ─────────────────

  const { countryMap, countryDataArray, maxRevenue, totalRevenue } = useMemo(() => {
    const map = new Map<string, CountryData>();

    // Build customer map by country
    const customersByCountry = new Map<string, SalesCustomer[]>();
    for (const c of customers) {
      const list = customersByCountry.get(c.country) || [];
      list.push(c);
      customersByCountry.set(c.country, list);
    }

    // Aggregate invoices
    const invoicesByCountry = new Map<string, { revenue: number; count: number }>();
    for (const inv of invoices) {
      const country = inv.customer?.country;
      if (!country) continue;
      const current = invoicesByCountry.get(country) || { revenue: 0, count: 0 };
      current.revenue += Number(inv.total_usd);
      current.count += 1;
      invoicesByCountry.set(country, current);
    }

    // Merge
    const allCountries = new Set([
      ...customersByCountry.keys(),
      ...invoicesByCountry.keys(),
    ]);
    for (const country of allCountries) {
      const clients = customersByCountry.get(country) || [];
      const invData = invoicesByCountry.get(country) || { revenue: 0, count: 0 };

      // Find top segment
      const segCounts: Record<string, number> = {};
      for (const c of clients) {
        segCounts[c.segment] = (segCounts[c.segment] || 0) + 1;
      }
      const topSegment =
        Object.entries(segCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "prospect";

      map.set(country, {
        country,
        iso3: COUNTRY_NAME_TO_GEO[country] || country,
        revenue: invData.revenue,
        invoices: invData.count,
        clients,
        avgDealSize: invData.count > 0 ? invData.revenue / invData.count : 0,
        topSegment,
      });
    }

    const arr = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const maxRev = Math.max(...arr.map((c) => c.revenue), 1);
    const totalRev = arr.reduce((s, c) => s + c.revenue, 0);

    return { countryMap: map, countryDataArray: arr, maxRevenue: maxRev, totalRevenue: totalRev };
  }, [invoices, customers]);

  // ── Load GeoJSON + register map ───────────────

  useEffect(() => {
    async function loadMap() {
      try {
        // Use Natural Earth 50m GeoJSON via observable — has proper country names
        // and correctly renders Russia without antimeridian artifacts
        const res = await fetch(
          "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"
        );
        const topology = await res.json();
        const { feature } = await import("topojson-client");
        const geojson = feature(topology, topology.objects.countries);

        // Map numeric IDs to country names using ISO 3166-1 numeric lookup
        const ISO_NUMERIC_TO_NAME: Record<string, string> = {
          "004": "Afghanistan", "008": "Albania", "012": "Algeria", "024": "Angola",
          "032": "Argentina", "036": "Australia", "040": "Austria", "050": "Bangladesh",
          "056": "Belgium", "068": "Bolivia", "070": "Bosnia and Herz.", "072": "Botswana",
          "076": "Brazil", "100": "Bulgaria", "104": "Myanmar", "108": "Burundi",
          "112": "Belarus", "116": "Cambodia", "120": "Cameroon", "124": "Canada",
          "140": "Central African Rep.", "144": "Sri Lanka", "148": "Chad",
          "152": "Chile", "156": "China", "170": "Colombia", "178": "Congo",
          "180": "Dem. Rep. Congo", "188": "Costa Rica", "191": "Croatia", "192": "Cuba",
          "196": "Cyprus", "203": "Czechia", "208": "Denmark",
          "214": "Dominican Rep.", "218": "Ecuador", "818": "Egypt",
          "222": "El Salvador", "226": "Eq. Guinea", "232": "Eritrea", "233": "Estonia",
          "231": "Ethiopia", "246": "Finland", "250": "France",
          "266": "Gabon", "270": "Gambia", "268": "Georgia", "276": "Germany",
          "288": "Ghana", "300": "Greece", "320": "Guatemala", "324": "Guinea",
          "328": "Guyana", "332": "Haiti", "340": "Honduras", "348": "Hungary",
          "352": "Iceland", "356": "India", "360": "Indonesia", "364": "Iran",
          "368": "Iraq", "372": "Ireland", "376": "Israel", "380": "Italy",
          "384": "Côte d'Ivoire", "388": "Jamaica", "392": "Japan", "400": "Jordan",
          "398": "Kazakhstan", "404": "Kenya", "408": "North Korea",
          "410": "South Korea", "414": "Kuwait", "417": "Kyrgyzstan",
          "418": "Laos", "422": "Lebanon", "426": "Lesotho", "430": "Liberia",
          "434": "Libya", "440": "Lithuania", "442": "Luxembourg",
          "450": "Madagascar", "454": "Malawi", "458": "Malaysia", "466": "Mali",
          "478": "Mauritania", "484": "Mexico", "496": "Mongolia",
          "504": "Morocco", "508": "Mozambique", "516": "Namibia",
          "524": "Nepal", "528": "Netherlands", "540": "New Caledonia",
          "554": "New Zealand", "558": "Nicaragua", "562": "Niger",
          "566": "Nigeria", "578": "Norway", "512": "Oman", "586": "Pakistan",
          "591": "Panama", "598": "Papua New Guinea", "600": "Paraguay",
          "604": "Peru", "608": "Philippines", "616": "Poland",
          "620": "Portugal", "630": "Puerto Rico", "634": "Qatar",
          "642": "Romania", "643": "Russia", "646": "Rwanda",
          "682": "Saudi Arabia", "686": "Senegal", "694": "Sierra Leone",
          "702": "Singapore", "703": "Slovakia", "704": "Vietnam",
          "705": "Slovenia", "706": "Somalia", "710": "South Africa",
          "724": "Spain", "728": "S. Sudan", "729": "Sudan",
          "740": "Suriname", "748": "eSwatini", "752": "Sweden",
          "756": "Switzerland", "760": "Syria", "762": "Tajikistan",
          "764": "Thailand", "768": "Togo", "780": "Trinidad and Tobago",
          "788": "Tunisia", "792": "Turkey", "795": "Turkmenistan",
          "800": "Uganda", "804": "Ukraine", "784": "United Arab Emirates",
          "826": "United Kingdom", "834": "Tanzania",
          "840": "United States of America", "858": "Uruguay",
          "860": "Uzbekistan", "862": "Venezuela", "887": "Yemen", "894": "Zambia",
          "716": "Zimbabwe", "010": "Antarctica",
          "260": "Fr. S. Antarctic Lands", "304": "Greenland",
          "275": "Palestine", "732": "W. Sahara",
          "158": "Taiwan", "498": "Moldova", "807": "North Macedonia",
          "688": "Serbia", "499": "Montenegro", "008a": "Kosovo",
        };

        // Assign names to features — handle both string and number IDs
        type GeoFeature = { id: string | number; properties: Record<string, string> };
        const features = (geojson as unknown as { features: GeoFeature[] }).features;
        for (const f of features) {
          // TopoJSON IDs can be numeric (e.g., 643) or zero-padded strings ("643")
          const idStr = String(f.id).padStart(3, "0");
          const name = ISO_NUMERIC_TO_NAME[idStr] || f.properties?.name || `Country ${f.id}`;
          f.properties = { ...f.properties, name };
        }

        echarts.registerMap("world", geojson as unknown as Parameters<typeof echarts.registerMap>[1]);
        setMapLoaded(true);
      } catch (err) {
        console.error("Failed to load world map:", err);
      }
    }
    loadMap();
  }, []);

  // ── Build ECharts options ─────────────────────

  const chartOption = useMemo(() => {
    if (!mapLoaded) return null;

    // Map series data — color countries by revenue
    const mapData: Array<{ name: string; value: number }> = [];
    for (const [country, data] of countryMap) {
      const geoName = COUNTRY_NAME_TO_GEO[country] || country;
      if (data.revenue > 0) {
        mapData.push({ name: geoName, value: data.revenue });
      }
    }

    // EffectScatter data — animated markers at country centers
    const scatterData = countryDataArray
      .filter((cd) => cd.revenue > 0 && COUNTRY_COORDS[cd.country])
      .map((cd) => ({
        name: cd.country,
        value: [
          ...COUNTRY_COORDS[cd.country]!,
          cd.revenue,
          cd.clients.length,
          cd.invoices,
          cd.avgDealSize,
        ],
      }));

    return {
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 1200,
      animationEasing: "cubicInOut" as const,
      tooltip: {
        trigger: "item" as const,
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: theme.tooltipText,
          fontSize: 11,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        },
        formatter: (params: { seriesType: string; name: string; value: number | number[]; color: string }) => {
          if (params.seriesType === "effectScatter") {
            const val = params.value as number[];
            return `
              <div style="min-width:180px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span>
                  <span style="font-weight:700;font-size:13px;">${params.name}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:10px;">
                  <span style="color:${theme.tooltipSub};">Revenue</span>
                  <span style="font-weight:600;text-align:right;color:#10b981;">$${(val[2] / 1000).toFixed(0)}K</span>
                  <span style="color:${theme.tooltipSub};">Clientes</span>
                  <span style="font-weight:600;text-align:right;">${val[3]}</span>
                  <span style="color:${theme.tooltipSub};">Facturas</span>
                  <span style="font-weight:600;text-align:right;">${val[4]}</span>
                  <span style="color:${theme.tooltipSub};">Ticket Prom.</span>
                  <span style="font-weight:600;text-align:right;">$${(val[5] / 1000).toFixed(1)}K</span>
                </div>
                <div style="margin-top:8px;font-size:9px;color:${theme.tooltipSub};font-style:italic;">
                  Click para ver detalle del país ➜
                </div>
              </div>
            `;
          }
          // Map series tooltip
          if (params.seriesType === "map" && typeof params.value === "number" && params.value > 0) {
            return `
              <div style="font-size:11px;">
                <span style="font-weight:700;">${params.name}</span>
                <br/>
                <span style="color:#10b981;font-weight:600;">$${(params.value / 1000).toFixed(0)}K</span> Revenue
              </div>
            `;
          }
          return "";
        },
      },
      visualMap: {
        type: "continuous" as const,
        min: 0,
        max: maxRevenue,
        text: ["Mayor", "Menor"],
        textStyle: {
          color: theme.isDark ? "#94a3b8" : "#475569",
          fontSize: 9,
        },
        realtime: false,
        calculable: true,
        orient: "vertical" as const,
        left: 16,
        bottom: 16,
        itemWidth: 10,
        itemHeight: 80,
        inRange: {
          color: theme.visualMapColors,
        },
      },
      geo: {
        map: "world",
        roam: true, // Enable zoom + pan
        scaleLimit: {
          min: 1,
          max: 12,
        },
        zoom: 1.2,
        center: [-20, 10],
        itemStyle: {
          areaColor: theme.areaColor,
          borderColor: theme.borderColor,
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: {
            areaColor: theme.areaHover,
            borderColor: theme.isDark ? "#60a5fa" : "#2563EB",
            borderWidth: 1.5,
            shadowBlur: 20,
            shadowColor: "rgba(59, 130, 246, 0.3)",
          },
          label: {
            show: true,
            color: theme.labelColor,
            fontSize: 10,
            fontWeight: 700,
          },
        },
        select: {
          itemStyle: {
            areaColor: "#3B82F6",
            borderColor: "#93c5fd",
            borderWidth: 2,
          },
          label: {
            show: true,
            color: "#fff",
          },
        },
        label: {
          show: false,
        },
      },
      series: [
        // Country choropleth layer
        {
          type: "map" as const,
          geoIndex: 0,
          data: mapData,
          selectedMode: false,
          animation: true,
          animationDurationUpdate: 500,
        },
        // Effect scatter — animated pulse markers
        {
          type: "effectScatter" as const,
          coordinateSystem: "geo" as const,
          data: scatterData,
          symbolSize: (val: number[]) => {
            return Math.max(6, Math.min(24, (val[2] / maxRevenue) * 24 + 4));
          },
          rippleEffect: {
            brushType: "stroke" as const,
            scale: 3,
            period: 4,
          },
          itemStyle: {
            color: "#10B981",
            shadowBlur: 10,
            shadowColor: "rgba(16, 185, 129, 0.4)",
          },
          label: {
            show: true,
            position: "right" as const,
            formatter: (params: { name: string; value: number[] }) => {
              return `{name|${params.name}} {val|$${(params.value[2] / 1000).toFixed(0)}K}`;
            },
            rich: {
              name: {
                fontSize: 9,
                color: theme.scatterLabelColor,
                fontWeight: 600,
              },
              val: {
                fontSize: 9,
                color: "#10B981",
                fontWeight: 700,
              },
            },
          },
          emphasis: {
            scale: true,
            itemStyle: {
              shadowBlur: 20,
              shadowColor: "rgba(16, 185, 129, 0.6)",
            },
          },
          zlevel: 1,
        },
      ],
    };
  }, [mapLoaded, countryMap, countryDataArray, maxRevenue, theme]);

  // ── Zoom to country animation ─────────────────
  const zoomToCountry = useCallback((countryName: string) => {
    if (!chartInstance.current) return;
    const coords = COUNTRY_COORDS[countryName];
    if (!coords) return;

    chartInstance.current.setOption({
      geo: {
        center: coords,
        zoom: 4,
      },
    });
  }, []);

  const resetZoom = useCallback(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption({
      geo: {
        center: [-20, 10],
        zoom: 1.2,
      },
    });
  }, []);

  // ── Init / Update ECharts ─────────────────────

  useEffect(() => {
    if (!chartRef.current || !chartOption) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    chartInstance.current.setOption(chartOption, true);

    // Click handler — open country drawer with zoom animation
    chartInstance.current.off("click");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartInstance.current.on("click", (params: any) => {
      if (!params.name) return;

      // Find the country data by matching the name
      let found: CountryData | null = null;
      for (const [country, data] of countryMap) {
        const geoName = COUNTRY_NAME_TO_GEO[country] || country;
        if (geoName === params.name || country === params.name) {
          found = data;
          break;
        }
      }
      if (found && found.revenue > 0) {
        zoomToCountry(found.country);
        setSelectedCountry(found);
      }
    });

    // Resize
    const obs = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    obs.observe(chartRef.current);

    return () => {
      obs.disconnect();
    };
  }, [chartOption, countryMap, zoomToCountry]);

  // Cleanup
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedCountry(null);
    resetZoom();
  }, [resetZoom]);

  return (
    <div className="space-y-4">
      {/* Map Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3B82F6]/10">
            <Globe size={14} className="text-[#3B82F6]" />
          </div>
          <div>
            <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">
              Mapa Global de Revenue
            </h3>
            <p className="text-[9px] text-[var(--text-muted)]">
              Scroll para zoom · Arrastra para navegar · Click en un país para detalle
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <div className="flex items-center gap-1.5">
            <DollarSign size={9} className="text-emerald-500" />
            <span className="text-[var(--text-muted)]">Revenue Global</span>
            <span className="font-bold text-emerald-500 tabular-nums">
              ${(totalRevenue / 1000).toFixed(0)}K
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={9} className="text-[#3B82F6]" />
            <span className="text-[var(--text-muted)]">Países activos</span>
            <span className="font-bold text-[var(--text-primary)]">
              {countryDataArray.filter((c) => c.revenue > 0).length}
            </span>
          </div>
        </div>
      </div>

      {/* ECharts Map */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-xl border border-[var(--border)]"
        style={{ backgroundColor: theme.mapBg }}
      >
        {!mapLoaded ? (
          <div className="flex h-[500px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Globe size={24} className="text-[#3B82F6]" />
              </motion.div>
              <p className="text-[10px] text-[var(--text-muted)]">
                Cargando mapa mundial...
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={chartRef}
            className="w-full h-[500px]"
            style={{ backgroundColor: theme.mapBg }}
          />
        )}
      </motion.div>

      {/* Country Ranking Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
        {countryDataArray
          .filter((cd) => cd.revenue > 0)
          .slice(0, 8)
          .map((cd, i) => {
            const pct =
              totalRevenue > 0 ? (cd.revenue / totalRevenue) * 100 : 0;
            return (
              <motion.div
                key={cd.country}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                onClick={() => {
                  zoomToCountry(cd.country);
                  setSelectedCountry(cd);
                }}
                className={cn(
                  "group cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-all relative overflow-hidden",
                  "hover:border-[#3B82F6]/30 hover:shadow-md hover:shadow-[#3B82F6]/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          cd.revenue > maxRevenue * 0.6
                            ? "#10B981"
                            : cd.revenue > maxRevenue * 0.3
                              ? "#3B82F6"
                              : "#1E3A5F",
                      }}
                    />
                    <span className="text-[10px] font-semibold text-[var(--text-primary)]">
                      {cd.country}
                    </span>
                  </div>
                  <span className="text-[8px] font-bold text-[var(--text-muted)]">
                    #{i + 1}
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="text-sm font-bold text-emerald-500 tabular-nums">
                    ${(cd.revenue / 1000).toFixed(0)}K
                  </span>
                  <span className="text-[8px] text-[var(--text-muted)]">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.5 + i * 0.05, duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981]"
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[8px] text-[var(--text-muted)]">
                  <span>{cd.clients.length} clientes</span>
                  <span>{cd.invoices} fact.</span>
                </div>
              </motion.div>
            );
          })}
      </div>

      {/* Country Detail Drawer */}
      <AnimatePresence>
        {selectedCountry && (
          <CountryDetailDrawer
            data={selectedCountry}
            invoices={invoices}
            onClose={handleCloseDrawer}
            isDark={theme.isDark}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Country Detail Drawer with ECharts ────────────

function CountryDetailDrawer({
  data,
  invoices,
  onClose,
  isDark,
}: {
  data: CountryData;
  invoices: SalesInvoice[];
  onClose: () => void;
  isDark: boolean;
}) {
  const router = useRouter();
  const pieRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pieChart = useRef<echarts.ECharts | null>(null);
  const barChart = useRef<echarts.ECharts | null>(null);

  const countryInvoices = useMemo(
    () =>
      invoices
        .filter((inv) => inv.customer?.country === data.country)
        .sort(
          (a, b) =>
            new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
        ),
    [invoices, data.country]
  );

  // Segment data for pie chart
  const segmentData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of countryInvoices) {
      const seg = inv.customer?.segment || "prospect";
      map[seg] = (map[seg] || 0) + Number(inv.total_usd);
    }
    return Object.entries(map)
      .map(([segment, revenue]) => {
        const segKey = segment as keyof typeof SEGMENT_COLORS;
        return {
          name: SEGMENT_LABELS[segKey] || segment,
          value: revenue,
          itemStyle: { color: SEGMENT_COLORS[segKey] || "#6B7280" },
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [countryInvoices]);

  // Monthly bar data
  const monthlyData = useMemo(() => {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
    return months.map((month, i) => {
      const monthInvs = countryInvoices.filter((inv) => {
        const d = new Date(inv.sale_date);
        return d.getMonth() === i && d.getFullYear() === 2026;
      });
      return {
        month,
        revenue: monthInvs.reduce((s, inv) => s + Number(inv.total_usd), 0),
        count: monthInvs.length,
      };
    });
  }, [countryInvoices]);

  const textColor = isDark ? "#e2e8f0" : "#1e293b";
  const subtextColor = isDark ? "#64748b" : "#94a3b8";

  // Init Pie chart
  useEffect(() => {
    if (!pieRef.current || segmentData.length === 0) return;

    const timeout = setTimeout(() => {
      if (!pieRef.current) return;
      pieChart.current = echarts.init(pieRef.current, undefined, { renderer: "canvas" });
      pieChart.current.setOption({
        animation: true,
        animationDuration: 800,
        animationEasing: "cubicOut",
        tooltip: {
          trigger: "item",
          backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.97)",
          borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(203,213,225,0.5)",
          borderWidth: 1,
          textStyle: { color: textColor, fontSize: 10 },
          formatter: (params: { name: string; value: number; percent: number }) =>
            `<b>${params.name}</b><br/>$${(params.value / 1000).toFixed(0)}K (${params.percent.toFixed(1)}%)`,
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            center: ["50%", "50%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 4,
              borderColor: isDark ? "#0f172a" : "#fff",
              borderWidth: 2,
            },
            label: {
              show: true,
              formatter: "{b}",
              fontSize: 9,
              color: subtextColor,
            },
            emphasis: {
              scale: true,
              scaleSize: 6,
              label: {
                show: true,
                fontSize: 11,
                fontWeight: "bold",
                color: textColor,
              },
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0,0,0,0.2)",
              },
            },
            data: segmentData,
          },
        ],
      });
    }, 200);

    return () => {
      clearTimeout(timeout);
      pieChart.current?.dispose();
      pieChart.current = null;
    };
  }, [segmentData, isDark, textColor, subtextColor]);

  // Init Bar chart
  useEffect(() => {
    if (!barRef.current) return;

    const timeout = setTimeout(() => {
      if (!barRef.current) return;
      barChart.current = echarts.init(barRef.current, undefined, { renderer: "canvas" });
      barChart.current.setOption({
        animation: true,
        animationDuration: 1000,
        animationEasing: "elasticOut",
        tooltip: {
          trigger: "axis",
          backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.97)",
          borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(203,213,225,0.5)",
          borderWidth: 1,
          textStyle: { color: textColor, fontSize: 10 },
          formatter: (params: Array<{ name: string; value: number }>) => {
            const p = params[0];
            return `<b>${p.name} 2026</b><br/>Revenue: <span style="color:#10b981;font-weight:600;">$${(p.value / 1000).toFixed(0)}K</span>`;
          },
        },
        grid: {
          left: 8,
          right: 8,
          top: 8,
          bottom: 24,
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: monthlyData.map((d) => d.month),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { fontSize: 9, color: subtextColor },
        },
        yAxis: {
          type: "value",
          show: false,
        },
        series: [
          {
            type: "bar",
            data: monthlyData.map((d) => d.revenue),
            barWidth: "60%",
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "#3B82F6" },
                { offset: 1, color: "#1d4ed8" },
              ]),
            },
            emphasis: {
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "#60a5fa" },
                  { offset: 1, color: "#3B82F6" },
                ]),
                shadowBlur: 10,
                shadowColor: "rgba(59,130,246,0.3)",
              },
            },
          },
        ],
      });
    }, 400);

    return () => {
      clearTimeout(timeout);
      barChart.current?.dispose();
      barChart.current = null;
    };
  }, [monthlyData, isDark, textColor, subtextColor]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 bg-gradient-to-r from-[#3B82F6]/5 to-transparent">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B82F6]/10"
            >
              <MapPin size={18} className="text-[#3B82F6]" />
            </motion.div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {data.country}
              </h2>
              <p className="text-[9px] text-[var(--text-muted)]">
                {data.clients.length} clientes · {data.invoices} facturas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: DollarSign, label: "Revenue Total", value: `$${(data.revenue / 1000).toFixed(0)}K`, color: "#10B981" },
              { icon: BarChart3, label: "Ticket Promedio", value: `$${(data.avgDealSize / 1000).toFixed(1)}K`, color: "#3B82F6" },
              { icon: TrendingUp, label: "Facturas", value: String(data.invoices), color: "#8B5CF6" },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
              >
                <div className="flex items-center gap-1.5">
                  <kpi.icon size={10} style={{ color: kpi.color }} />
                  <span className="text-[8px] text-[var(--text-muted)]">{kpi.label}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{kpi.value}</p>
              </motion.div>
            ))}
          </div>

          {/* ECharts: Revenue por Segmento (Pie) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Layers size={10} className="text-[#8B5CF6]" />
              <h4 className="text-[10px] font-semibold text-[var(--text-primary)]">
                Revenue por Segmento
              </h4>
            </div>
            <div ref={pieRef} className="w-full h-44" />
          </motion.div>

          {/* ECharts: Revenue Mensual (Bar) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 size={10} className="text-[#3B82F6]" />
              <h4 className="text-[10px] font-semibold text-[var(--text-primary)]">
                Revenue Mensual 2026
              </h4>
            </div>
            <div ref={barRef} className="w-full h-36" />
          </motion.div>

          {/* Client List — inline expandable */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Users size={10} className="text-[#06B6D4]" />
              <h4 className="text-[10px] font-semibold text-[var(--text-primary)]">
                Clientes ({data.clients.length})
              </h4>
            </div>
            <div className="space-y-1.5">
              {data.clients.map((client, i) => (
                <ClientExpandableCard key={client.id} client={client} index={i} />
              ))}
            </div>
          </motion.div>

          {/* Recent Invoices — inline expandable */}
          {countryInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <FileText size={10} className="text-[#F59E0B]" />
                <h4 className="text-[10px] font-semibold text-[var(--text-primary)]">
                  Facturas Recientes ({countryInvoices.length})
                </h4>
              </div>
              <div className="space-y-1">
                {countryInvoices.slice(0, 8).map((inv, i) => (
                  <InvoiceExpandableCard key={inv.id} invoice={inv} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── Client Expandable Card ────────────────────────

function ClientExpandableCard({ client, index }: { client: SalesCustomer; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const initials = (client.trade_name || client.business_name)
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 + index * 0.04 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-[var(--bg-card)] px-3 py-2.5 text-left transition-all group",
          expanded
            ? "border-[#06B6D4]/40 shadow-sm"
            : "border-[var(--border)] hover:bg-[var(--bg-muted)] hover:border-[#06B6D4]/30 hover:shadow-sm"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {client.logo_url && !imgError ? (
            <img
              src={client.logo_url}
              alt=""
              onError={() => setImgError(true)}
              className="h-6 w-6 rounded-md object-cover ring-1 ring-[var(--border)]"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#3B82F6]/20 to-[#06B6D4]/20 text-[7px] font-bold text-[#3B82F6]">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[var(--text-primary)] truncate">
              {client.trade_name || client.business_name}
            </p>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: SEGMENT_COLORS[client.segment] || '#6B7280' }}
              />
              <p className="text-[8px] text-[var(--text-muted)]">
                {SEGMENT_LABELS[client.segment] || client.segment}
              </p>
              <span className="text-[7px] text-[var(--text-muted)]">·</span>
              <p className="text-[8px] font-medium tabular-nums" style={{
                color: client.health_score >= 80 ? '#10B981' : client.health_score >= 50 ? '#F59E0B' : '#EF4444'
              }}>
                {client.health_score}pts
              </p>
              {client.total_revenue > 0 && (
                <>
                  <span className="text-[7px] text-[var(--text-muted)]">·</span>
                  <p className="text-[8px] font-bold text-emerald-500 tabular-nums">
                    ${(client.total_revenue / 1000).toFixed(0)}K
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronDown size={12} className="shrink-0 text-[#06B6D4]" />
        ) : (
          <ChevronRight size={12} className="shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-1 mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <DetailRow label="Razón Social" value={client.business_name} />
                <DetailRow label="Nombre Comercial" value={client.trade_name || "—"} />
                <DetailRow label="Sector" value={client.sector || "—"} />
                <DetailRow label="Tamaño" value={client.company_size || "—"} />
                <DetailRow label="Ciudad" value={client.city || "—"} />
                <DetailRow label="País" value={client.country} />
                {client.address && <DetailRow label="Dirección" value={client.address} span2 />}
                <DetailRow label="Tax ID" value={client.tax_id || "—"} />
                <DetailRow label="Crédito" value={`$${Number(client.credit_limit).toLocaleString("en")}`} />
                <DetailRow label="Total Órdenes" value={String(client.total_orders)} />
                <DetailRow label="Revenue" value={`$${Number(client.total_revenue).toLocaleString("en")}`} />
              </div>
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[8px] text-[#3B82F6] hover:underline"
                >
                  <ExternalLink size={8} />
                  {client.website}
                </a>
              )}
              {/* Health bar */}
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-[var(--text-muted)]">Health</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${client.health_score}%`,
                      backgroundColor: client.health_score >= 80 ? '#10B981' : client.health_score >= 50 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
                <span className="text-[8px] font-bold tabular-nums" style={{
                  color: client.health_score >= 80 ? '#10B981' : client.health_score >= 50 ? '#F59E0B' : '#EF4444'
                }}>
                  {client.health_score}/100
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Invoice Expandable Card ───────────────────────

function InvoiceExpandableCard({ invoice, index }: { invoice: SalesInvoice; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const status = invoice.status as InvoiceStatus;
  const statusColor = INVOICE_STATUS_COLORS[status] || '#6B7280';
  const statusLabel = INVOICE_STATUS_LABELS[status] || invoice.status;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.7 + index * 0.03 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2 transition-all group text-left",
          expanded
            ? "bg-[var(--bg-muted)] shadow-sm"  
            : "bg-[var(--bg-muted)]/50 hover:bg-[var(--bg-muted)] hover:shadow-sm"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-[#3B82F6]/10">
            <FileText size={9} className="text-[#3B82F6]" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-[#3B82F6]">
              {invoice.invoice_number}
            </p>
            <p className="text-[7px] text-[var(--text-muted)] truncate">
              {invoice.customer?.trade_name || invoice.customer?.business_name || 'Cliente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="rounded-full px-1.5 py-0.5 text-[7px] font-medium"
            style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
          >
            {statusLabel}
          </span>
          <span className="text-[9px] font-bold text-emerald-500 tabular-nums">
            ${Number(invoice.total_usd).toLocaleString("en")}
          </span>
          {expanded ? (
            <ChevronDown size={10} className="text-[#3B82F6]" />
          ) : (
            <ChevronRight size={10} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-1 mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <DetailRow label="Factura" value={invoice.invoice_number} />
                <DetailRow label="Status" value={statusLabel} />
                <DetailRow label="Fecha de Venta" value={new Date(invoice.sale_date).toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" })} />
                {invoice.due_date && (
                  <DetailRow label="Vencimiento" value={new Date(invoice.due_date).toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" })} />
                )}
                <DetailRow label="Cliente" value={invoice.customer?.trade_name || invoice.customer?.business_name || "—"} />
                <DetailRow label="País" value={invoice.customer?.country || "—"} />
                <DetailRow label="Moneda" value={invoice.currency || "USD"} />
                <DetailRow label="Cantidad Items" value={String(invoice.items?.length || "—")} />
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border)]">
                <span className="text-[8px] font-semibold text-[var(--text-muted)]">TOTAL</span>
                <span className="text-[11px] font-bold text-emerald-500 tabular-nums">
                  ${Number(invoice.total_usd).toLocaleString("en")}
                </span>
              </div>
              {invoice.notes && (
                <p className="text-[8px] text-[var(--text-muted)] italic">
                  {invoice.notes}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Detail Row helper ─────────────────────────────

function DetailRow({ label, value, span2 }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <span className="text-[7px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <p className="text-[9px] font-medium text-[var(--text-primary)] truncate">{value}</p>
    </div>
  );
}

