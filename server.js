import "dotenv/config";
import { readFileSync } from "fs";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "15mb" }));
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

app.listen(port, () => {
  console.log(`Tabi running at http://localhost:${port}`);
});
