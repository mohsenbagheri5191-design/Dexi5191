// Pinly — City data aggregator (Toronto). Public, read-only.
// Fetches events, places, weather/air, and news server-side so API keys stay secret.
// Set the news key as a secret:  supabase secrets set GNEWS_API_KEY=xxxx
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function j(url: string, opts?: RequestInit) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return await r.json();
}

async function getWeather(lat: number, lng: number) {
  try {
    const w = await j(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
    let aqi: number | null = null;
    try {
      const a = await j(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`);
      aqi = a?.current?.us_aqi ?? null;
    } catch (_) { /* optional */ }
    return {
      temp: w?.current?.temperature_2m ?? null,
      feels: w?.current?.apparent_temperature ?? null,
      code: w?.current?.weather_code ?? null,
      wind: w?.current?.wind_speed_10m ?? null,
      hi: w?.daily?.temperature_2m_max?.[0] ?? null,
      lo: w?.daily?.temperature_2m_min?.[0] ?? null,
      aqi,
    };
  } catch (_) { return null; }
}

async function getPlaces(lat: number, lng: number) {
  try {
    const d = await j(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lng}&gsradius=6000&gslimit=25&format=json&origin=*`);
    return (d?.query?.geosearch || []).map((g: any) => ({
      title: g.title, lat: g.lat, lng: g.lon, dist: g.dist,
      url: `https://en.wikipedia.org/?curid=${g.pageid}`,
    }));
  } catch (_) { return []; }
}

async function getEvents() {
  try {
    const base = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action";
    const pkg = await j(`${base}/package_show?id=festivals-events`);
    const res = (pkg?.result?.resources || []).find((r: any) => r.datastore_active);
    if (!res) return [];
    const ds = await j(`${base}/datastore_search?resource_id=${res.id}&limit=60`);
    const recs = ds?.result?.records || [];
    return recs.map((r: any) => {
      const c = r.calEvent || r;
      const loc = c?.locations?.[0] || {};
      let plat: number | null = null, plng: number | null = null;
      const coords = loc.coords || c.coords;
      if (typeof coords === "string" && coords.includes(",")) {
        const [a, b] = coords.split(",").map((x: string) => parseFloat(x.trim()));
        if (!isNaN(a) && !isNaN(b)) { plat = a; plng = b; }
      }
      return {
        title: c.eventName || r.eventName || r.title || r.name || "Event",
        when: c.startDate || r.startDate || r.dates || "",
        venue: loc.locationName || r.location || "",
        url: c.eventWebsite || r.eventWebsite || "",
        lat: plat, lng: plng,
      };
    }).filter((e: any) => e.title && e.title !== "Event");
  } catch (_) { return []; }
}

async function getNews() {
  const key = Deno.env.get("GNEWS_API_KEY");
  if (!key) return [];
  try {
    const d = await j(`https://gnews.io/api/v4/search?q=Toronto&lang=en&country=ca&max=10&token=${key}`);
    return (d?.articles || []).map((a: any) => ({
      title: a.title, source: a?.source?.name || "", url: a.url, image: a.image, when: a.publishedAt,
    }));
  } catch (_) { return []; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const u = new URL(req.url);
  const lat = parseFloat(u.searchParams.get("lat") || "43.6532");
  const lng = parseFloat(u.searchParams.get("lng") || "-79.3832");
  const [weather, places, events, news] = await Promise.all([
    getWeather(lat, lng), getPlaces(lat, lng), getEvents(), getNews(),
  ]);
  return new Response(JSON.stringify({ weather, places, events, news }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
