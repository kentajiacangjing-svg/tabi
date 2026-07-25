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

const affiliateProviders = JSON.parse(readFileSync(new URL("./data/affiliate-providers.json", import.meta.url)));

function buildAffiliateUrl(category, query) {
  const provider = affiliateProviders.find((p) => p.category === category);
  if (!provider) return null;
  const url = provider.searchUrlTemplate.replace("{query}", encodeURIComponent(query || "Tokyo")) + provider.affiliateParam;
  return { provider: provider.name, url };
}

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

function buildConciergeSystemPrompt() {
  return `You are a knowledgeable, friendly AI concierge for tourists visiting Japan.
Given a free-text question or request (e.g. "what should I do in Shinjuku tonight", "3 days in Kyoto, love temples and food"), respond with 2-5 concrete recommendations.

There are two kinds of recommendations. Pick the right type for each one:

1. "affiliate" — use when the request is about restaurants or hotels. Do NOT invent a specific restaurant/hotel name or address. Instead recommend the category in that area, e.g. title "Restaurants in Shinjuku" or "Hotels near Shibuya Station". Set "affiliateCategory" to "restaurant" or "hotel", and "area" to the neighborhood/city. Never include a contactUrl yourself — the server attaches the real link.

2. "info" — general, practical, well-known recommendations for everything else (sightseeing, transport, tickets, shopping, tips, etc). No price/contactUrl.

Respond ONLY with valid JSON matching this shape, no markdown fences, no extra text:
{
  "recommendations": [
    {
      "title": "string, short name of the place/activity",
      "area": "string, neighborhood or city",
      "description": "1-2 sentence description, practical and specific, not generic marketing text",
      "tip": "one concrete practical tip (timing, cost, how to avoid crowds, etc.)",
      "type": "info or affiliate",
      "affiliateCategory": "restaurant or hotel, only if type is affiliate"
    }
  ]
}`;
}

function attachAffiliateLinks(data) {
  if (!data || !Array.isArray(data.recommendations)) return data;
  data.recommendations = data.recommendations.map((rec) => {
    if (rec.type !== "affiliate") return rec;
    const link = buildAffiliateUrl(rec.affiliateCategory, rec.area);
    if (!link) return { ...rec, type: "info" };
    return { ...rec, provider: link.provider, contactUrl: link.url };
  });
  return data;
}

app.post("/api/concierge", async (req, res) => {
  try {
    const { query, language } = req.body;
    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system: buildConciergeSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `${query}\n\nRespond in ${language || "English"}.`,
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const parsed = attachAffiliateLinks(JSON.parse(text));
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const DEFAULT_FIELDS = "place_id,name,geometry,rating,user_ratings_total,price_level,opening_hours,photos,types,vicinity,formatted_address";

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

    const params = new URLSearchParams({ query, key: PLACES_KEY });
    if (lat && lng) params.set("location", `${lat},${lng}`), params.set("radius", "3000");

    const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
    const data = await r.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return res.status(502).json({ error: data.error_message || data.status });
    }
    const origin = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
    const results = (data.results || []).map((p) => simplifyPlace(p, origin));
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
