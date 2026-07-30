// Pinly — City data aggregator. Public, read-only. Works ANYWHERE the user pans the map.
// Sources: Ticketmaster (events w/ images, needs key), OpenStreetMap Overpass (POIs, keyless),
// Wikipedia GeoSearch (landmarks + thumbnails, keyless), Open-Meteo (weather/air, keyless),
// GNews (headlines, keyed).
//
// Secrets (Supabase → Edge Functions → city → Secrets):
//   TICKETMASTER_KEY  — free at developer.ticketmaster.com → real events with photos worldwide
//   GNEWS_API_KEY     — free at gnews.io (a fallback key is inlined)
//
// Deployed with verify_jwt=false (public read-only).
// URL: <SUPABASE_URL>/functions/v1/city?lat=..&lng=..
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function j(url: string, opts?: RequestInit) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(url.slice(0, 80) + " -> " + r.status);
  return await r.json();
}

async function getWeather(lat: number, lng: number) {
  try {
    const w = await j(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
    let aqi: number | null = null;
    try {
      const a = await j(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`);
      aqi = a?.current?.us_aqi ?? null;
    } catch (_) {}
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

// Landmarks + thumbnails from Wikipedia (works worldwide)
async function getPlaces(lat: number, lng: number) {
  try {
    const d = await j(`https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}%7C${lng}&ggsradius=8000&ggslimit=24&prop=pageimages|coordinates|description&piprop=thumbnail&pithumbsize=320&format=json&origin=*`);
    const pages = d?.query?.pages ? Object.values(d.query.pages) as any[] : [];
    return pages.map((p: any) => ({
      title: p.title,
      lat: p.coordinates?.[0]?.lat ?? null,
      lng: p.coordinates?.[0]?.lon ?? null,
      image: p.thumbnail?.source ?? null,
      venue: p.description ?? "",
      url: `https://en.wikipedia.org/?curid=${p.pageid}`,
    })).filter((p: any) => p.lat != null);
  } catch (_) { return []; }
}

// Cafes / bars / parks / venues near the viewport — keyless, worldwide
async function getSpots(lat: number, lng: number) {
  const q = `[out:json][timeout:12];(
    node["amenity"~"^(cafe|bar|pub|restaurant|nightclub|theatre|cinema|marketplace)$"](around:2500,${lat},${lng});
    node["leisure"~"^(park|garden|sports_centre)$"](around:2500,${lat},${lng});
    node["tourism"~"^(museum|artwork|attraction|viewpoint)$"](around:2500,${lat},${lng});
  );out body 60;`;
  try {
    const d = await j("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    });
    return (d?.elements || []).filter((e: any) => e.tags?.name).map((e: any) => ({
      title: e.tags.name,
      lat: e.lat, lng: e.lon,
      kind: e.tags.amenity || e.tags.leisure || e.tags.tourism || "place",
      venue: (e.tags["addr:street"] ? e.tags["addr:street"] : (e.tags.cuisine || e.tags.amenity || "")),
      url: e.tags.website || null,
    })).slice(0, 50);
  } catch (_) { return []; }
}

// Real events with photos, venues and ticket links — worldwide (needs a free key)
async function getEvents(lat: number, lng: number) {
  const key = Deno.env.get("TICKETMASTER_KEY");
  if (key) {
    try {
      const d = await j(`https://app.ticketmaster.com/discovery/v2/events.json?latlong=${lat},${lng}&radius=25&unit=km&size=40&sort=date,asc&apikey=${key}`);
      const evs = d?._embedded?.events || [];
      const out = evs.map((e: any) => {
        const v = e?._embedded?.venues?.[0];
        const img = (e.images || []).slice().sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
        return {
          title: e.name,
          when: e.dates?.start?.localDate ? (e.dates.start.localDate + (e.dates.start.localTime ? " " + e.dates.start.localTime.slice(0, 5) : "")) : "",
          venue: v?.name || "",
          lat: v?.location?.latitude ? parseFloat(v.location.latitude) : null,
          lng: v?.location?.longitude ? parseFloat(v.location.longitude) : null,
          image: img?.url || null,
          url: e.url || null,
          kind: e.classifications?.[0]?.segment?.name || "Event",
        };
      }).filter((e: any) => e.lat != null);
      if (out.length) return out;
    } catch (_) {}
  }
  // Fallback: City of Toronto festivals (keyless, Toronto only)
  try {
    const base = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action";
    const pkg = await j(`${base}/package_show?id=festivals-events`);
    const res = (pkg?.result?.resources || []).find((r: any) => r.datastore_active);
    if (!res) return [];
    const ds = await j(`${base}/datastore_search?resource_id=${res.id}&limit=60`);
    return (ds?.result?.records || []).map((r: any) => {
      const c = r.calEvent || r;
      const loc = c?.locations?.[0] || {};
      let plat: number | null = null, plng: number | null = null;
      const coords = loc.coords || c.coords;
      if (typeof coords === "string" && coords.includes(",")) {
        const [a, b] = coords.split(",").map((x: string) => parseFloat(x.trim()));
        if (!isNaN(a) && !isNaN(b)) { plat = a; plng = b; }
      }
      return {
        title: c.eventName || r.eventName || r.title || "Event",
        when: c.startDate || r.startDate || "",
        venue: loc.locationName || "",
        url: c.eventWebsite || "",
        image: null,
        kind: "Festival",
        lat: plat, lng: plng,
      };
    }).filter((e: any) => e.title && e.title !== "Event");
  } catch (_) { return []; }
}

async function getNews(lat: number, lng: number) {
  const key = Deno.env.get("GNEWS_API_KEY") || "2b6d42fe90e95691994131565e0fa120";
  if (!key) return [];
  let place = "local";
  try {
    const g = await j(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    place = g?.city || g?.locality || g?.principalSubdivision || "local";
  } catch (_) {}
  try {
    const d = await j(`https://gnews.io/api/v4/search?q=${encodeURIComponent(place)}&lang=en&max=10&token=${key}`);
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
  const [weather, places, spots, events, news] = await Promise.all([
    getWeather(lat, lng), getPlaces(lat, lng), getSpots(lat, lng), getEvents(lat, lng), getNews(lat, lng),
  ]);
  return new Response(JSON.stringify({ weather, places, spots, events, news }), {
    headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=300" },
  });
});
