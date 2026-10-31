"""Refresh the generated sections of README.md from ai-api-prices.json.

Runs in the daily workflow after the download, so the README always shows
today's numbers. Only text between the <!-- name:start --> and
<!-- name:end --> markers is replaced.
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
data = json.loads((ROOT / "ai-api-prices.json").read_text(encoding="utf-8"))
rows = data["prices"]

LABELS = {
    "text": "LLM / text", "image": "Image generation", "video": "Video generation",
    "transcription": "Speech-to-text", "tts": "Text-to-speech", "search": "Web search", "embedding": "Embeddings",
}


def money(value: float) -> str:
    if value >= 0.1:
        return f"${value:,.2f}"
    return f"${value:.3f}" if value >= 0.01 else f"${value:.4f}"


def stats() -> str:
    by_category = defaultdict(lambda: {"rows": 0, "models": set(), "providers": set()})
    for row in rows:
        entry = by_category[row["category"]]
        entry["rows"] += 1
        entry["models"].add(row["model_slug"])
        entry["providers"].add(row["provider_id"])
    lines = [
        f"**{len(rows):,} prices** for **{len({(r['category'], r['model_slug']) for r in rows}):,} models** "
        f"from **{len({r['provider_id'] for r in rows})} providers**, last updated **{data['updated']}**.",
        "",
        "| Category | Prices | Models | Providers |",
        "|---|---:|---:|---:|",
    ]
    for category in LABELS:
        if category in by_category:
            entry = by_category[category]
            lines.append(f"| {LABELS[category]} | {entry['rows']:,} | {len(entry['models']):,} | {len(entry['providers'])} |")
    return "\n".join(lines)


def gaps() -> str:
    models = defaultdict(list)
    for row in rows:
        if row["category"] != "text" or row.get("variant"):
            continue
        prices = (row.get("input_usd_per_1m_tokens"), row.get("output_usd_per_1m_tokens"))
        if None in prices or min(prices) < 0:
            continue
        blended = (3 * prices[0] + prices[1]) / 4
        if blended > 0:
            models[(row["model_slug"], row["model"])].append((blended, row["provider"]))
    ranked = []
    for (slug, name), offers in models.items():
        providers = {}
        for price, provider in offers:
            providers[provider] = min(price, providers.get(provider, price))
        if len(providers) < 3:
            continue
        ordered = sorted(providers.items(), key=lambda item: item[1])
        median = sorted(providers.values())[len(providers) // 2]
        ranked.append((len(providers), slug, name, ordered[0], median, ordered[-1]))
    # The most widely sold models first: the comparison people actually need.
    ranked.sort(key=lambda item: (-item[0], item[1]))
    lines = [
        "| Model | Providers | Cheapest | Typical | Most expensive | Gap |",
        "|---|---:|---|---:|---|---:|",
    ]
    for count, slug, name, cheapest, median, priciest in ranked[:10]:
        lines.append(
            f"| [{name}](https://aiselect.online/models/{slug}) | {count} | {cheapest[0]} {money(cheapest[1])} "
            f"| {money(median)} | {priciest[0]} {money(priciest[1])} | **{priciest[1] / cheapest[1]:.1f}×** |"
        )
    lines += ["", "*Blended list price per 1M tokens (3 input : 1 output), standard tier. The ten models sold by the most providers; typical is the median provider.*"]
    return "\n".join(lines)


readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
for name, body in (("stats", stats()), ("gaps", gaps())):
    readme = re.sub(
        rf"(<!-- {name}:start -->).*?(<!-- {name}:end -->)",
        lambda match: f"{match.group(1)}\n{body}\n{match.group(2)}",
        readme,
        flags=re.S,
    )
readme_path.write_text(readme, encoding="utf-8")
