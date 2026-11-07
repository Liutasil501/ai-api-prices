// Queries over ai-api-prices.json: find a model, list its providers by price,
// estimate a monthly bill, compare two models, list the cheapest models.
// Pure functions; the server loads the data and formats the answers.

export const CATEGORIES = ["text", "image", "video", "transcription", "tts", "search", "embedding"];

/** The headline price of a row and what it is per. */
export const UNIT = {
  text: { field: "blended", label: "per 1M tokens (blended 3 input : 1 output)", usage: "million tokens" },
  embedding: { field: "input_usd_per_1m_tokens", label: "per 1M tokens", usage: "million tokens" },
  image: { field: "usd_per_image", label: "per image", usage: "images" },
  video: { field: "usd_per_video_second", label: "per second of video", usage: "seconds of video" },
  transcription: { field: "usd_per_audio_hour", label: "per audio hour", usage: "audio hours" },
  tts: { field: "usd_per_1m_characters", label: "per 1M characters", usage: "million characters" },
  search: { field: "usd_per_1k_searches", label: "per 1,000 searches", usage: "thousand searches" },
};

// Equal prices list the model developer first, then inference hosts, then clouds (as on AISelect.online).
const KIND_ORDER = { first_party: 0, inference_host: 1, cloud: 2 };

const normalize = (value) => String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const compact = (value) => normalize(value).replace(/ /g, "");
// Identity of a display name for alias merging: symbols that name a different model (the "+" in "Command R+") count.
const identity = (value) => normalize(String(value ?? "").replace(/\+/g, " plus "));

/** Headline price in USD for one row, or undefined when the row has none. */
export function headlinePrice(row) {
  if (row.category === "text") {
    if (typeof row.input_usd_per_1m_tokens !== "number" || typeof row.output_usd_per_1m_tokens !== "number") return undefined;
    return (3 * row.input_usd_per_1m_tokens + row.output_usd_per_1m_tokens) / 4;
  }
  const value = row[UNIT[row.category]?.field];
  return typeof value === "number" ? value : undefined;
}

/** The most frequent value; ties go to the one listed first (callers pass rows cheapest first). */
const mostCommon = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
};

/** "quality=hd;width=1792;height=1024" -> "hd, 1792×1024". */
export function variantLabel(variant) {
  if (!variant) return "";
  const parts = Object.fromEntries(String(variant).split(";").map((pair) => pair.split("=")));
  const size = parts.width && parts.height ? `${parts.width}×${parts.height}` : "";
  return [...Object.entries(parts).filter(([key]) => key !== "width" && key !== "height").map(([, value]) => value), size].filter(Boolean).join(", ");
}

/**
 * Rows grouped by category and model, each group sorted cheapest first.
 * Rows that share a slug or a display name are one model: a host's alias
 * ("claude-sonnet-5-5-default", "databricks-...") joins the main model with
 * its offers instead of standing alone. Billing variants of one provider
 * (sizes, quality) stay separate offers with a `variant` label.
 */
export function groupModels(rows) {
  const priced = rows.map((row) => ({ ...row, price: headlinePrice(row) })).filter((row) => row.price !== undefined && row.price > 0);
  const parent = new Map();
  const find = (key) => { while (parent.get(key) !== key) key = parent.get(key); return key; };
  const union = (a, b) => { parent.set(find(a), find(b)); };
  for (const row of priced) {
    const slugKey = `${row.category}:slug:${row.model_slug}`;
    const nameKey = `${row.category}:name:${identity(row.model)}`;
    for (const key of [slugKey, nameKey]) if (!parent.has(key)) parent.set(key, key);
    union(slugKey, nameKey);
  }
  const members = new Map();
  for (const row of priced) {
    const root = find(`${row.category}:slug:${row.model_slug}`);
    if (!members.has(root)) members.set(root, []);
    members.get(root).push(row);
  }
  return [...members.values()].map((group) => {
    // One offer per provider and variant, the cheapest: an alias row repeats the same price.
    const seen = new Set();
    const offers = [...group]
      .sort((a, b) => a.price - b.price || (KIND_ORDER[a.provider_type] ?? 3) - (KIND_ORDER[b.provider_type] ?? 3) || a.provider.localeCompare(b.provider))
      .filter((row) => {
        const key = `${row.provider_id ?? row.provider}|${row.variant ?? ""}`;
        return seen.has(key) ? false : seen.add(key);
      })
      .map((row) => ({ ...row, variant_label: variantLabel(row.variant) }));
    const slugs = [...new Set(group.map((row) => row.model_slug))];
    return { category: group[0].category, model: mostCommon(offers.map((row) => row.model)), slug: mostCommon(offers.map((row) => row.model_slug)), slugs, offers };
  });
}

/** Each provider once, at its cheapest variant: the basis for counts, spreads and savings. */
export function providerOffers(model) {
  const seen = new Set();
  return model.offers.filter((offer) => (seen.has(offer.provider) ? false : seen.add(offer.provider)));
}

/** Best matches for a model name: exact slug, then prefix, then all words; widely sold models first. */
export function findModels(models, query, category, limit = 10) {
  const words = normalize(query).split(" ").filter(Boolean);
  const target = compact(query);
  // "Command R+" must win over "Command R": symbols that name another model break exact-match ties.
  const strict = compact(identity(query));
  const literal = String(query ?? "").trim().toLowerCase();
  if (!words.length) return [];
  return models
    .filter((model) => !category || model.category === category)
    .map((model) => {
      const name = compact(model.model);
      const slugs = (model.slugs ?? [model.slug]).map(compact);
      const hay = `${normalize(model.model)} ${(model.slugs ?? [model.slug]).map(normalize).join(" ")}`;
      if (!words.every((word) => hay.includes(word) || hay.replace(/ /g, "").includes(word))) return undefined;
      const exact = name === target || slugs.includes(target);
      const strictExact = compact(identity(model.model)) === strict || slugs.includes(strict);
      const literalSlug = (model.slugs ?? [model.slug]).includes(literal);
      const prefix = name.startsWith(target) || slugs.some((slug) => slug.startsWith(target));
      const score = (literalSlug ? 200 : strictExact ? 120 : exact ? 100 : 0) + (prefix ? 30 : 0) + providerOffers(model).length * 2 - name.length * 0.2;
      return { model, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.model);
}

/** Link to the comparison page on AISelect.online for a model. */
export function pageUrl(model) {
  if (model.category === "text") return `https://aiselect.online/models/${model.slug}`;
  const hub = { image: "ai-image-api", video: "ai-video-api", transcription: "speech-to-text-api", tts: "text-to-speech-api", search: "web-search-api", embedding: "embedding-api" }[model.category];
  return `https://aiselect.online/pricing/${hub}`;
}

/** Monthly cost per provider for a usage; text takes input and output millions, everything else one usage number. */
export function monthlyCosts(model, usage) {
  return model.offers
    .map((offer) => {
      const cost = model.category === "text"
        ? (usage.input ?? 0) * offer.input_usd_per_1m_tokens + (usage.output ?? 0) * offer.output_usd_per_1m_tokens
        : (usage.units ?? 0) * offer.price;
      return { provider: offer.provider, variant: offer.variant_label ?? "", cost, source_url: offer.source_url };
    })
    .sort((a, b) => a.cost - b.cost || a.provider.localeCompare(b.provider));
}

/** The cheapest models of a category by their cheapest provider; text needs at least `minProviders` hosts. */
export function cheapestModels(models, category, limit = 10, minProviders = 1) {
  return models
    .filter((model) => model.category === category && providerOffers(model).length >= minProviders)
    .sort((a, b) => a.offers[0].price - b.offers[0].price || a.model.localeCompare(b.model))
    .slice(0, limit);
}

/** "$0.065", "$1.20", "$0.0003": enough digits to tell cheap prices apart. */
export function usd(value) {
  if (value >= 0.1) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${Number(value.toPrecision(3))}`;
}
