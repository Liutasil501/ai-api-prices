import assert from "node:assert/strict";
import { test } from "node:test";
import { cheapestModels, findModels, groupModels, headlinePrice, monthlyCosts, pageUrl, providerOffers, usd, variantLabel } from "./prices.js";

const rows = [
  { category: "text", model: "gpt-oss-120b", model_slug: "gpt-oss-120b", provider: "W&B Inference", input_usd_per_1m_tokens: 0.03, output_usd_per_1m_tokens: 0.17, source_url: "https://wandb.ai" },
  { category: "text", model: "gpt-oss-120b", model_slug: "gpt-oss-120b", provider: "Cloudflare", input_usd_per_1m_tokens: 0.35, output_usd_per_1m_tokens: 0.75, source_url: "https://cloudflare.com" },
  { category: "text", model: "gpt-oss-20b", model_slug: "gpt-oss-20b", provider: "DeepInfra", input_usd_per_1m_tokens: 0.03, output_usd_per_1m_tokens: 0.13, source_url: "https://deepinfra.com" },
  { category: "text", model: "Claude Sonnet 5.5", model_slug: "claude-sonnet-5-5", provider: "Anthropic", input_usd_per_1m_tokens: 2, output_usd_per_1m_tokens: 10, source_url: "https://claude.com" },
  { category: "image", model: "flux-schnell", model_slug: "flux-schnell", provider: "fal", usd_per_image: 0.003, source_url: "https://fal.ai" },
  { category: "image", model: "broken", model_slug: "broken", provider: "x", usd_per_image: 0, source_url: "https://x" },
];
const models = groupModels(rows);

test("headline price blends text 3 input : 1 output and reads the unit price otherwise", () => {
  assert.equal(headlinePrice(rows[0]), 0.065);
  assert.equal(headlinePrice(rows[4]), 0.003);
});

test("groups rows by model, cheapest provider first, and drops free or unpriced rows", () => {
  const gpt = models.find((model) => model.slug === "gpt-oss-120b");
  assert.deepEqual(gpt.offers.map((offer) => offer.provider), ["W&B Inference", "Cloudflare"]);
  assert.equal(models.some((model) => model.slug === "broken"), false);
});

test("equal prices list the developer first", () => {
  const tie = groupModels([
    { category: "text", model: "M", model_slug: "m", provider: "Amazon Bedrock", provider_type: "cloud", input_usd_per_1m_tokens: 1, output_usd_per_1m_tokens: 2 },
    { category: "text", model: "M", model_slug: "m", provider: "Maker", provider_type: "first_party", input_usd_per_1m_tokens: 1, output_usd_per_1m_tokens: 2 },
  ])[0];
  assert.equal(tie.offers[0].provider, "Maker");
});

test("a host alias joins its model with its provider, found by either slug", () => {
  const withAlias = groupModels([...rows, { category: "text", model: "Claude Sonnet 5.5", model_slug: "claude-sonnet-5-5-default", provider: "Vertex", input_usd_per_1m_tokens: 2, output_usd_per_1m_tokens: 10 }]);
  const hits = findModels(withAlias, "claude sonnet");
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].offers.map((offer) => offer.provider).sort(), ["Anthropic", "Vertex"]);
  assert.equal(findModels(withAlias, "claude-sonnet-5-5-default")[0].slug, "claude-sonnet-5-5");
});

test("a name that differs only by a symbol is a different model", () => {
  const cohere = groupModels([
    { category: "text", model: "Command R", model_slug: "command-r-08-2024", provider: "Cohere", input_usd_per_1m_tokens: 0.15, output_usd_per_1m_tokens: 0.6 },
    { category: "text", model: "Command R+", model_slug: "command-r-plus-08-2024", provider: "Cohere", input_usd_per_1m_tokens: 2.5, output_usd_per_1m_tokens: 10 },
  ]);
  assert.equal(cohere.length, 2);
  const plus = findModels(cohere, "command-r-plus-08-2024")[0];
  assert.equal(plus.model, "Command R+");
  assert.equal(monthlyCosts(plus, { input: 1, output: 1 })[0].cost, 12.5);
  assert.equal(findModels(cohere, "Command R+")[0].model, "Command R+");
  assert.equal(findModels(cohere, "Command R")[0].model, "Command R");
});

test("price variants of one provider count as one provider", () => {
  const dalle = groupModels([
    { category: "image", model: "dall-e-3", model_slug: "dall-e-3", provider: "OpenAI", variant: "quality=standard;width=1024;height=1024", usd_per_image: 0.04 },
    { category: "image", model: "dall-e-3", model_slug: "dall-e-3", provider: "OpenAI", variant: "quality=hd;width=1792;height=1024", usd_per_image: 0.12 },
  ])[0];
  assert.equal(dalle.offers.length, 2);
  assert.equal(providerOffers(dalle).length, 1);
  assert.equal(variantLabel("quality=hd;width=1792;height=1024"), "hd, 1792×1024");
  assert.deepEqual(monthlyCosts(dalle, { units: 1000 }).map((row) => row.variant), ["standard, 1024×1024", "hd, 1792×1024"]);
});

test("finds the exact model before longer or similar names", () => {
  const nemotron = groupModels([
    { category: "text", model: "nemotron-3-5-lightning", model_slug: "nvidia-nemotron-3-5-lightning-30b-a3b", provider: "W&B Inference", input_usd_per_1m_tokens: 0.1, output_usd_per_1m_tokens: 0.4 },
    { category: "text", model: "Nemotron 3.5 Lightning 30B A3B", model_slug: "nemotron-3-5-lightning", provider: "Nebius", input_usd_per_1m_tokens: 0.1, output_usd_per_1m_tokens: 0.4 },
  ]);
  assert.equal(findModels(nemotron, "nemotron-3-5-lightning")[0].slug, "nemotron-3-5-lightning");
  assert.equal(findModels(models, "gpt-oss-120b")[0].slug, "gpt-oss-120b");
  assert.equal(findModels(models, "claude sonnet")[0].slug, "claude-sonnet-5-5");
  assert.equal(findModels(models, "flux", "text").length, 0);
});

test("monthly cost uses input and output for LLMs and units otherwise", () => {
  const gpt = models.find((model) => model.slug === "gpt-oss-120b");
  assert.deepEqual(monthlyCosts(gpt, { input: 10, output: 2 }).map((row) => Number(row.cost.toFixed(2))), [0.64, 5]);
  const flux = models.find((model) => model.slug === "flux-schnell");
  assert.equal(monthlyCosts(flux, { units: 1000 })[0].cost, 3);
});

test("cheapest models respect the minimum provider count", () => {
  assert.deepEqual(cheapestModels(models, "text", 5, 2).map((model) => model.slug), ["gpt-oss-120b"]);
  assert.deepEqual(cheapestModels(models, "text", 5, 1).map((model) => model.slug), ["gpt-oss-20b", "gpt-oss-120b", "claude-sonnet-5-5"]);
});

test("links and money formatting", () => {
  assert.equal(pageUrl(models.find((model) => model.slug === "gpt-oss-120b")), "https://aiselect.online/models/gpt-oss-120b");
  assert.equal(pageUrl(models.find((model) => model.slug === "flux-schnell")), "https://aiselect.online/pricing/ai-image-api");
  assert.equal(usd(1.2), "$1.20");
  assert.equal(usd(0.1), "$0.10");
  assert.equal(usd(1234.5), "$1,234.50");
  assert.equal(usd(0.065), "$0.065");
  assert.equal(usd(0.0893), "$0.0893");
  assert.equal(usd(0.0003), "$0.0003");
});
