"use server";

// ─── OpenWeatherMap Marine Weather ──────────────

export type OWMWeatherResult = {
  airTemp: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  cloudCover: number;
  windSpeed: number;
  windDeg: number;
  windGust: number;
  description: string;
  icon: string;
  sunrise: string;
  sunset: string;
};

export type OWMForecastItem = {
  dt: string;
  airTemp: number;
  windSpeed: number;
  windDeg: number;
  description: string;
  icon: string;
  precipitation: number;
};

const OWM_KEY = process.env.OPENWEATHERMAP_API_KEY;

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function owmIconToEmoji(icon: string): string {
  const map: Record<string, string> = {
    "01d": "☀️", "01n": "🌙", "02d": "⛅", "02n": "☁️",
    "03d": "☁️", "03n": "☁️", "04d": "🌥️", "04n": "🌥️",
    "09d": "🌧️", "09n": "🌧️", "10d": "🌦️", "10n": "🌧️",
    "11d": "⛈️", "11n": "⛈️", "13d": "🌨️", "13n": "🌨️",
    "50d": "🌫️", "50n": "🌫️",
  };
  return map[icon] ?? "🌤️";
}

function beaufortFromKnots(knots: number): number {
  if (knots < 1) return 0;
  if (knots < 4) return 1;
  if (knots < 7) return 2;
  if (knots < 11) return 3;
  if (knots < 17) return 4;
  if (knots < 22) return 5;
  if (knots < 28) return 6;
  if (knots < 34) return 7;
  if (knots < 41) return 8;
  if (knots < 48) return 9;
  if (knots < 56) return 10;
  if (knots < 64) return 11;
  return 12;
}

export async function fetchMarineWeather(lat: number, lon: number): Promise<{
  current: OWMWeatherResult;
  forecast: OWMForecastItem[];
  windDir: string;
  beaufort: number;
} | null> {
  if (!OWM_KEY) {
    console.error("[OWM] Missing OPENWEATHERMAP_API_KEY");
    return null;
  }

  try {
    // Current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es`,
      { next: { revalidate: 300 } } // Cache 5 min
    );
    if (!currentRes.ok) throw new Error(`OWM current: ${currentRes.status}`);
    const cData = await currentRes.json();

    // 5-day / 3-hour forecast
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&lang=es&cnt=8`,
      { next: { revalidate: 600 } } // Cache 10 min
    );
    if (!forecastRes.ok) throw new Error(`OWM forecast: ${forecastRes.status}`);
    const fData = await forecastRes.json();

    const windSpeedKnots = +(cData.wind.speed * 1.944).toFixed(1); // m/s to knots
    const windGustKnots = cData.wind.gust ? +(cData.wind.gust * 1.944).toFixed(1) : windSpeedKnots;

    const current: OWMWeatherResult = {
      airTemp: +cData.main.temp.toFixed(1),
      feelsLike: +cData.main.feels_like.toFixed(1),
      humidity: cData.main.humidity,
      pressure: cData.main.pressure,
      visibility: +(cData.visibility / 1000).toFixed(1),
      cloudCover: cData.clouds.all,
      windSpeed: windSpeedKnots,
      windDeg: cData.wind.deg,
      windGust: windGustKnots,
      description: cData.weather[0]?.description ?? "",
      icon: owmIconToEmoji(cData.weather[0]?.icon ?? "01d"),
      sunrise: new Date(cData.sys.sunrise * 1000).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
      sunset: new Date(cData.sys.sunset * 1000).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
    };

    const forecast: OWMForecastItem[] = fData.list.map((item: Record<string, unknown>) => {
      const main = item.main as { temp: number };
      const wind = item.wind as { speed: number; deg: number };
      const weather = (item.weather as Array<{ description: string; icon: string }>)[0];
      const rain = item.rain as { "3h"?: number } | undefined;
      return {
        dt: new Date((item.dt as number) * 1000).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        airTemp: +main.temp.toFixed(1),
        windSpeed: +(wind.speed * 1.944).toFixed(1),
        windDeg: wind.deg,
        description: weather?.description ?? "",
        icon: owmIconToEmoji(weather?.icon ?? "01d"),
        precipitation: rain?.["3h"] ?? 0,
      };
    });

    return {
      current,
      forecast,
      windDir: degToCompass(cData.wind.deg),
      beaufort: beaufortFromKnots(windSpeedKnots),
    };
  } catch (err) {
    console.error("[OWM] Error:", err);
    return null;
  }
}

// ─── NOAA Tides & Currents ──────────────────────
// NOAA CO-OPS API: https://tidesandcurrents.noaa.gov/api/
// Using La Libertad, Ecuador as reference station (nearest with data)
// Note: NOAA stations are primarily US-based; for Ecuador we use nearest or fallback

export type NOAATideEntry = {
  time: string;
  height: number;
  type: "high" | "low";
};

export type NOAAResult = {
  stationName: string;
  stationId: string;
  tides: NOAATideEntry[];
  waterLevel: number | null;
};

export async function fetchNOAATides(stationId = "9414290"): Promise<NOAAResult | null> {
  try {
    const today = new Date();
    const beginDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = `${tomorrow.getFullYear()}${String(tomorrow.getMonth() + 1).padStart(2, "0")}${String(tomorrow.getDate()).padStart(2, "0")}`;

    // High/Low tide predictions
    const tidesRes = await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${beginDate}&end_date=${endDate}&station=${stationId}&product=predictions&datum=MLLW&units=metric&time_zone=lst_ldt&application=grixi&format=json&interval=hilo`,
      { next: { revalidate: 3600 } } // Cache 1 hour
    );

    // Water level (latest observation)
    const waterLevelRes = await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${stationId}&product=water_level&datum=MLLW&units=metric&time_zone=lst_ldt&application=grixi&format=json`,
      { next: { revalidate: 600 } } // Cache 10 min
    );

    let tides: NOAATideEntry[] = [];
    if (tidesRes.ok) {
      const tidesData = await tidesRes.json();
      if (tidesData.predictions) {
        tides = tidesData.predictions.map((p: { t: string; v: string; type: string }) => ({
          time: p.t.split(" ")[1] ?? p.t,
          height: +parseFloat(p.v).toFixed(2),
          type: p.type === "H" ? "high" as const : "low" as const,
        }));
      }
    }

    let waterLevel: number | null = null;
    if (waterLevelRes.ok) {
      const wlData = await waterLevelRes.json();
      if (wlData.data?.[0]?.v) {
        waterLevel = +parseFloat(wlData.data[0].v).toFixed(2);
      }
    }

    return {
      stationName: "San Francisco, CA", // Will vary by station
      stationId,
      tides: tides.slice(0, 6), // Max 6 entries
      waterLevel,
    };
  } catch (err) {
    console.error("[NOAA] Error:", err);
    return null;
  }
}
