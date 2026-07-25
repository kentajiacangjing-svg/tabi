import "dotenv/config";
import { readFileSync } from "fs";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "15mb" }));
app.get("/", (req, res) => res.redirect("/app.html"));
app.use(express.static("public"));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

const affiliateProviders = JSON.parse(readFileSync(new URL("./data/affiliate-providers.json", import.meta.url)));

function buildAffiliateUrl(category, query) {
  const provider = affiliateProviders.find((p) => p.category === category);
  if (!provider) return null;
  const url = provider.searchUrlTemplate.replace("{query}", encodeURIComponent(query || "Tokyo")) + provider.affiliateParam;
  return { provider: provider.name, url };
}

// ---------- Places helpers ----------
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function simplifyPlace(p, origin) {
  const loc = p.geometry?.location;
  const distanceM = loc && origin ? haversine(origin.lat, origin.lng, loc.lat, loc.lng) : null;
  return {
    placeId: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    userRatingsTotal: p.user_ratings_total ?? null,
    priceLevel: p.price_level ?? null,
    openNow: p.opening_hours?.open_now ?? null,
    types: p.types || [],
    address: p.vicinity || p.formatted_address || "",
    distanceMeters: distanceM,
    photoRef: p.photos?.[0]?.photo_reference || null,
  };
}

async function placesTextSearch(query, origin) {
  if (!PLACES_KEY) return [];
  const params = new URLSearchParams({ query, key: PLACES_KEY });
  if (origin) {
    params.set("location", `${origin.lat},${origin.lng}`);
    params.set("radius", "3000");
  }
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  const data = await r.json();
  if (data.status !== "OK") return [];
  return (data.results || []).map((p) => simplifyPlace(p, origin));
}

// ---------- Photo analyzer (legacy prototype feature, still used) ----------
const SYSTEM_PROMPT = `You are a friendly guide for foreign tourists in Japan looking at an unfamiliar machine, sign, or game (often a UFO catcher / claw machine at a game center).
Given a photo, explain in the user's requested language:
1. What this is
2. How to use/play it (step by step)
3. Practical tips (e.g. how to win a claw machine, where to get coins, etiquette)
Keep it short, friendly, and practical. Use simple sentences.`;

app.post("/api/analyze", async (req, res) => {
  try {
    const { imageBase64, mediaType, language } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Explain this in ${language || "English"}.`,
            },
          ],
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    res.json({ result: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

// ---------- AI concierge ----------
function buildConciergeSystemPrompt() {
  return `You are Tabi, a knowledgeable, friendly AI travel concierge for tourists visiting Japan.
Given a free-text question or request (e.g. "what should I do in Shinjuku tonight", "plan my afternoon", "3 days in Kyoto"), respond with 2-5 concrete recommendations, optionally as a rough time-ordered plan if the user asked for a plan/itinerary.

Always reply in the same language the user wrote in, unless they ask for a different language.

There are three kinds of recommendations. Pick the right type for each one:

1. "place" — use for ANY specific real restaurant, cafe, attraction, shop, or venue. Do NOT invent the name, rating, price, or address yourself — just give a short "searchHint" (e.g. "sushi restaurant Shibuya" or "teamLab Borderless") describing what to look up, plus your reasoning in "tip". The server will look up the real place and attach real data. If suggesting a plan with multiple stops, you can suggest an approximate time of day in "suggestedTime" (e.g. "14:00", "Evening") — this is only a suggestion, never a guaranteed booking.

2. "affiliate" — use when recommending restaurants/hotels in general (not one specific place). Title should be the category+area, e.g. "Restaurants in Shinjuku". Set "affiliateCategory" to "restaurant" or "hotel", and "area" to the neighborhood/city. Never include a contactUrl yourself.

3. "info" — general, practical, non-place advice (transport tips, general area guidance, etiquette, weather-appropriate ideas, etc). No price/contactUrl.

Never invent specific prices, ratings, or "available at X time" claims — only the server-verified "place" type carries real data.

Respond ONLY with valid JSON matching this shape, no markdown fences, no extra text:
{
  "recommendations": [
    {
      "title": "string",
      "area": "string, neighborhood or city",
      "description": "1-2 sentence description, practical and specific, not generic marketing text",
      "tip": "one concrete practical tip or reasoning",
      "type": "place, info, or affiliate",
      "searchHint": "string, only if type is place",
      "suggestedTime": "string, only if type is place and this is part of a plan",
      "affiliateCategory": "restaurant or hotel, only if type is affiliate"
    }
  ]
}`;
}

async function enrichRecommendations(data, origin) {
  if (!data || !Array.isArray(data.recommendations)) return data;
  data.recommendations = await Promise.all(
    data.recommendations.map(async (rec) => {
      if (rec.type === "affiliate") {
        const link = buildAffiliateUrl(rec.affiliateCategory, rec.area);
        if (!link) return { ...rec, type: "info" };
        return { ...rec, provider: link.provider, contactUrl: link.url };
      }
      if (rec.type === "place") {
        const results = await placesTextSearch(rec.searchHint || rec.title, origin);
        if (!results.length) return { ...rec, type: "info" };
        return { ...rec, place: results[0] };
      }
      return rec;
    })
  );
  return data;
}

app.post("/api/concierge", async (req, res) => {
  try {
    const { query, language, lat, lng } = req.body;
    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system: buildConciergeSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `${query}\n\n(If replying in a specific language was requested by the app UI, prefer that language: ${language || "auto-detect from the user's message"}.)`,
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const origin = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const parsed = await enrichRecommendations(JSON.parse(text), origin);
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

// ---------- Places endpoints ----------
const DEFAULT_FIELDS = "place_id,name,geometry,rating,user_ratings_total,price_level,opening_hours,photos,types,vicinity,formatted_address";

app.get("/api/places/nearby", async (req, res) => {
  try {
    if (!PLACES_KEY) return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY is not set" });
    const { lat, lng, type, keyword, openNow } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });

    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: "1500",
      key: PLACES_KEY,
    });
    if (type) params.set("type", type);
    if (keyword) params.set("keyword", keyword);
    if (openNow === "true") params.set("opennow", "true");

    const r = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
    const data = await r.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return res.status(502).json({ error: data.error_message || data.status });
    }
    const origin = { lat: parseFloat(lat), lng: parseFloat(lng) };
    const results = (data.results || []).map((p) => simplifyPlace(p, origin));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

app.get("/api/places/search", async (req, res) => {
  try {
    if (!PLACES_KEY) return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY is not set" });
    const { query, lat, lng } = req.query;
    if (!query) return res.status(400).json({ error: "query is required" });
    const origin = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const results = await placesTextSearch(query, origin);
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

app.get("/api/places/:placeId", async (req, res) => {
  try {
    if (!PLACES_KEY) return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY is not set" });
    const params = new URLSearchParams({
      place_id: req.params.placeId,
      fields: DEFAULT_FIELDS + ",formatted_phone_number,website,opening_hours/weekday_text,url",
      key: PLACES_KEY,
    });
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    const data = await r.json();
    if (data.status !== "OK") return res.status(502).json({ error: data.error_message || data.status });
    const p = data.result;
    res.json({
      ...simplifyPlace(p, null),
      phone: p.formatted_phone_number || null,
      website: p.website || null,
      googleMapsUrl: p.url || null,
      weekdayText: p.opening_hours?.weekday_text || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

app.get("/api/places/photo/:ref", async (req, res) => {
  try {
    if (!PLACES_KEY) return res.status(500).send("GOOGLE_PLACES_API_KEY is not set");
    const params = new URLSearchParams({ maxwidth: "600", photo_reference: req.params.ref, key: PLACES_KEY });
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/photo?${params}`, { redirect: "follow" });
    res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).send("");
  }
});

app.listen(port, () => {
  console.log(`Tabi running at http://localhost:${port}`);
});
