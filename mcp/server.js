#!/usr/bin/env node
// MCP server for AI API prices: lets Claude, Cursor or any MCP client look up
// what a model costs at every provider, with each provider's pricing page.
// Data: https://aiselect.online/data/ai-api-prices.json (refreshed daily),
// with this repository's copy as fallback. Runs over stdio.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CATEGORIES, UNIT, cheapestModels, findModels, groupModels, monthlyCosts, pageUrl, providerOffers, usd } from "./prices.js";

const SOURCES = [
  "https://aiselect.online/data/ai-api-prices.json",
  "https://raw.githubusercontent.com/Liutasil501/ai-api-prices/main/ai-api-prices.json",
];
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
let cache;

async function load() {
  if (cache && Date.now() - cache.at < MAX_AGE_MS) return cache;
  let lastError;
  for (const url of SOURCES) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "ai-api-prices-mcp/1.0" } });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const data = await response.json();
      cache = { at: Date.now(), updated: data.updated, models: groupModels(data.prices) };
      return cache;
    } catch (error) {
      lastError = error;
    }
  }
  if (cache) return cache;
  throw lastError;
}

const footer = (updated) => `\nList prices from each provider's pricing page, updated ${updated}. Data: AISelect.online (MIT), https://aiselect.online/open-data`;
const text = (body) => ({ content: [{ type: "text", text: body }] });
/** "12 providers" or "1 provider, 12 price variants". */
function sellers(model) {
  const count = providerOffers(model).length;
  const variants = model.offers.length > count ? `, ${model.offers.length} price variants` : "";
  return `${count} provider${count === 1 ? "" : "s"}${variants}`;
}
const withVariant = (offer) => (offer.variant_label ? `${offer.provider} (${offer.variant_label})` : offer.provider);

const categorySchema = z.enum(CATEGORIES).optional().describe("text (LLMs), image, video, transcription, tts, search or embedding");

async function resolve(name, category) {
  const data = await load();
  const [model] = findModels(data.models, name, category, 1);
  return { data, model };
}

function notFound(name, data, category) {
  const close = findModels(data.models, name.split(/\s+/)[0], category, 5);
  return text(`No model matches "${name}".${close.length ? ` Close matches: ${close.map((model) => model.model).join(", ")}.` : ""}`);
}

const server = new McpServer({ name: "ai-api-prices", version: "1.0.0" });

server.registerTool("find_models", {
  title: "Find AI models",
  description: "Search AI API models by name (LLMs, image, video, speech, embeddings, web search) and get each one's cheapest provider and price.",
  inputSchema: { query: z.string().describe("Model name or part of it, e.g. \"gpt-oss\", \"claude sonnet\", \"flux\""), category: categorySchema },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ query, category }) => {
  const data = await load();
  const hits = findModels(data.models, query, category, 10);
  if (!hits.length) return notFound(query, data, category);
  const lines = hits.map((model) => `- ${model.model} (${model.category}): from ${usd(model.offers[0].price)} ${UNIT[model.category].label} at ${withVariant(model.offers[0])}, ${sellers(model)}. ${pageUrl(model)}`);
  return text(lines.join("\n") + footer(data.updated));
});

server.registerTool("model_prices", {
  title: "Prices of one model at every provider",
  description: "List what one AI model costs at every provider that sells it, cheapest first, with input, output and cached prices for LLMs and a link to each provider's pricing page.",
  inputSchema: { model: z.string().describe("Model name, e.g. \"gpt-oss-120b\" or \"Claude Sonnet 5.5\""), category: categorySchema },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ model: name, category }) => {
  const { data, model } = await resolve(name, category);
  if (!model) return notFound(name, data, category);
  const rows = model.offers.map((offer, index) => model.category === "text"
    ? `${index + 1}. ${offer.provider}: ${usd(offer.input_usd_per_1m_tokens)} input / ${usd(offer.output_usd_per_1m_tokens)} output per 1M tokens${typeof offer.cached_input_usd_per_1m_tokens === "number" ? `, cached input ${usd(offer.cached_input_usd_per_1m_tokens)}` : ""}${offer.context_tokens ? `, ${offer.context_tokens.toLocaleString("en-US")} context` : ""}. ${offer.source_url}`
    : `${index + 1}. ${withVariant(offer)}: ${usd(offer.price)} ${UNIT[model.category].label}. ${offer.source_url}`);
  // Spread across providers, each at its cheapest variant: sizes and quality levels are not interchangeable.
  const byProvider = providerOffers(model);
  const spread = byProvider.length > 1 && byProvider.at(-1).price > byProvider[0].price * 1.005 ? ` Across providers, the most expensive charges ${(byProvider.at(-1).price / byProvider[0].price).toFixed(1)}x the cheapest.` : "";
  const variants = model.offers.length > byProvider.length ? " Prices differ by size or quality, so compare the variant you need." : "";
  return text(`${model.model} (${model.category}) at ${sellers(model)}, cheapest first.${spread}${variants}\n${rows.join("\n")}\nCompare with your volume: ${pageUrl(model)}${footer(data.updated)}`);
});

server.registerTool("estimate_monthly_cost", {
  title: "Estimate a monthly bill",
  description: "Estimate the monthly cost of a workload for one model at every provider. LLMs take input and output tokens in millions; other categories take one usage number (images, seconds of video, audio hours, million characters, thousand searches, million tokens).",
  inputSchema: {
    model: z.string().describe("Model name"),
    input_million_tokens: z.number().nonnegative().optional().describe("LLMs: input tokens per month, in millions"),
    output_million_tokens: z.number().nonnegative().optional().describe("LLMs: output tokens per month, in millions"),
    units: z.number().nonnegative().optional().describe("Other categories: monthly usage in the category's unit"),
    category: categorySchema,
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ model: name, input_million_tokens: input, output_million_tokens: output, units, category }) => {
  const { data, model } = await resolve(name, category);
  if (!model) return notFound(name, data, category);
  if (model.category === "text" && input === undefined && output === undefined) return text("Give input_million_tokens and output_million_tokens for an LLM.");
  if (model.category !== "text" && units === undefined) return text(`Give units: ${UNIT[model.category].usage} per month.`);
  const costs = monthlyCosts(model, { input, output, units });
  const usage = model.category === "text" ? `${input ?? 0}M input + ${output ?? 0}M output tokens` : `${units} ${UNIT[model.category].usage}`;
  // Savings only between providers, each at its cheapest variant.
  const perProvider = costs.filter((row, index) => costs.findIndex((other) => other.provider === row.provider) === index);
  const gap = perProvider.length > 1 ? perProvider.at(-1).cost - perProvider[0].cost : 0;
  const saving = perProvider.length < 2 ? "" : gap > 0.005 ? `\nThe cheapest provider saves ${usd(gap)} a month against the most expensive.` : "\nSame price at every provider.";
  return text(`${model.model}, ${usage} a month:\n${costs.map((row, index) => `${index + 1}. ${row.provider}${row.variant ? ` (${row.variant})` : ""}: ${usd(row.cost)}`).join("\n")}${saving}\nStandard list prices only; caching, batch and volume discounts are not included. ${pageUrl(model)}${footer(data.updated)}`);
});

server.registerTool("compare_models", {
  title: "Compare two models on price",
  description: "Compare two AI models by their cheapest provider's price, with how many providers sell each.",
  inputSchema: { model_a: z.string().describe("First model"), model_b: z.string().describe("Second model"), category: categorySchema },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ model_a: nameA, model_b: nameB, category }) => {
  const [{ data, model: a }, { model: b }] = await Promise.all([resolve(nameA, category), resolve(nameB, category)]);
  if (!a) return notFound(nameA, data, category);
  if (!b) return notFound(nameB, data, category);
  const line = (model) => `- ${model.model}: from ${usd(model.offers[0].price)} ${UNIT[model.category].label} at ${withVariant(model.offers[0])} (${sellers(model)}). ${pageUrl(model)}`;
  const [cheap, dear] = a.offers[0].price <= b.offers[0].price ? [a, b] : [b, a];
  const ratio = dear.offers[0].price / cheap.offers[0].price;
  const verdict = a.category !== b.category ? "They are different kinds of models, so the prices are not comparable." : ratio < 1.01 ? "Same price at their cheapest providers." : `${cheap.model} is ${ratio.toFixed(1)}x cheaper at its cheapest provider.`;
  const duel = a.category === "text" && b.category === "text" ? `\nHead to head with accuracy and your monthly bill: https://aiselect.online/compare/${a.slug}-vs-${b.slug}` : "";
  return text(`${line(a)}\n${line(b)}\n${verdict}${duel}${footer(data.updated)}`);
});

server.registerTool("cheapest_models", {
  title: "Cheapest models in a category",
  description: "List the cheapest AI models in a category by their cheapest provider. For LLMs only models sold by at least two providers count, so one-off listings do not crowd the list.",
  inputSchema: { category: z.enum(CATEGORIES).describe("text, image, video, transcription, tts, search or embedding"), limit: z.number().int().min(1).max(25).optional() },
  annotations: { readOnlyHint: true, openWorldHint: true },
}, async ({ category, limit }) => {
  const data = await load();
  const list = cheapestModels(data.models, category, limit ?? 10, category === "text" ? 2 : 1);
  return text(`Cheapest ${category} models ${UNIT[category].label}:\n${list.map((model, index) => `${index + 1}. ${model.model}: ${usd(model.offers[0].price)} at ${withVariant(model.offers[0])}. ${pageUrl(model)}`).join("\n")}${footer(data.updated)}`);
});

await server.connect(new StdioServerTransport());
