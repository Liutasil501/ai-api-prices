<div align="center">

<a href="https://aiselect.online"><img src="assets/home.png" alt="AISelect.online: every AI model, every provider, the real price" width="100%"></a>

# AI API prices

**A free, daily-updated dataset of AI API list prices across 58 providers.**
LLMs, image and video generation, speech-to-text, text-to-speech, web search and embeddings, in one JSON and one CSV file.

[![Updated daily](https://img.shields.io/github/last-commit/Liutasil501/ai-api-prices?label=updated&color=ff5a36)](https://github.com/Liutasil501/ai-api-prices/commits/main)
[![License: MIT](https://img.shields.io/badge/license-MIT-0d1311)](LICENSE)
[![Explore on AISelect.online](https://img.shields.io/badge/explore-aiselect.online-2f9e6e)](https://aiselect.online)

[**Explore the data**](https://aiselect.online) · [JSON](ai-api-prices.json) · [CSV](ai-api-prices.csv) · [Price changes](https://aiselect.online/changes) · [Methodology](https://aiselect.online/methodology)

</div>

## Why this exists

The same open-weight model often costs several times more at one provider than at another, and nobody publishes those prices side by side. This repository does, every day, as plain files you can load into a spreadsheet, a notebook or your own app.

<!-- stats:start -->
**2,005 prices** for **1,242 models** from **58 providers**, last updated **2026-10-31**.

| Category | Prices | Models | Providers |
|---|---:|---:|---:|
| LLM / text | 1,693 | 1,012 | 37 |
| Image generation | 112 | 76 | 9 |
| Video generation | 60 | 40 | 9 |
| Speech-to-text | 10 | 9 | 7 |
| Text-to-speech | 28 | 26 | 7 |
| Web search | 20 | 7 | 14 |
| Embeddings | 82 | 72 | 16 |
<!-- stats:end -->

## Same model, very different price

The ten most widely sold models today, from the cheapest to the most expensive provider:

<!-- gaps:start -->
| Model | Providers | Cheapest | Typical | Most expensive | Gap |
|---|---:|---|---:|---|---:|
| [gpt-oss-120b](https://aiselect.online/models/gpt-oss-120b) | 18 | W&B Inference (CoreWeave) $0.065 | $0.26 | Cloudflare Workers AI $0.45 | **6.9×** |
| [GLM-5.2](https://aiselect.online/models/glm-5-2) | 13 | DeepInfra $1.16 | $2.15 | Scaleway $3.04 | **2.6×** |
| [Llama-3.3-70B-Instruct](https://aiselect.online/models/llama3-3-70b-instruct) | 13 | Nebius Token Factory $0.20 | $0.72 | Scaleway $1.01 | **5.1×** |
| [GLM-5.3](https://aiselect.online/models/glm-5-3) | 12 | DeepInfra $1.68 | $2.15 | Amazon Bedrock $2.58 | **1.5×** |
| [GLM-5.3-Flash](https://aiselect.online/models/glm-5-3-flash) | 11 | Baseten $0.24 | $0.24 | Z.ai $0.24 | **1.0×** |
| [Llama-3.1-8B-Instruct](https://aiselect.online/models/llama-3-1-8b-instruct) | 11 | Novita AI $0.028 | $0.10 | Oracle Cloud Generative AI $0.72 | **26.2×** |
| [DeepSeek V4 Flash 0731](https://aiselect.online/models/deepseek-v4-flash-0731) | 10 | DeepInfra $0.10 | $0.56 | Novita AI $0.66 | **6.3×** |
| [gpt-oss-20b](https://aiselect.online/models/gpt-oss-20b) | 10 | W&B Inference (CoreWeave) $0.055 | $0.13 | Cloudflare Workers AI $0.23 | **4.1×** |
| [Kimi K3](https://aiselect.online/models/kimi-k3) | 9 | SiliconFlow $5.40 | $6.00 | Together AI $6.00 | **1.1×** |
| [DeepSeek-R1](https://aiselect.online/models/deepseek-r1) | 8 | SiliconFlow $0.92 | $4.00 | SambaNova $5.50 | **6.0×** |

*Blended list price per 1M tokens (3 input : 1 output), standard tier. The ten models sold by the most providers; typical is the median provider.*
<!-- gaps:end -->

## What it looks like on AISelect.online

The website turns this dataset into calculators, rankings and head-to-head comparisons.

<table>
  <tr>
    <td width="50%"><a href="https://aiselect.online/models/gpt-oss-120b"><img src="assets/calculator.png" alt="Monthly cost of gpt-oss-120b at 18 providers"></a><br><sub><b>Your monthly cost at every provider.</b> Enter your token volume, get a ranking.</sub></td>
    <td width="50%"><a href="https://aiselect.online/compare/xai-vs-openai"><img src="assets/compare.png" alt="xAI vs OpenAI: every model's API price compared"></a><br><sub><b>Head to head.</b> Grok vs GPT, Claude vs Gemini and more, with accuracy next to price.</sub></td>
  </tr>
  <tr>
    <td width="50%"><a href="https://aiselect.online/models/gpt-oss-120b"><img src="assets/model.png" alt="gpt-oss-120b model page with price spread"></a><br><sub><b>Every model page.</b> Cheapest provider, price spread, GPQA accuracy, context.</sub></td>
    <td width="50%" align="center"><a href="https://aiselect.online"><img src="assets/mobile.png" alt="AISelect.online on a phone" width="60%"></a><br><sub><b>Works on a phone.</b> No sign-up, no paid rankings.</sub></td>
  </tr>
</table>

## Use it

**curl + jq**: every provider of one model, cheapest first

```bash
curl -s https://raw.githubusercontent.com/Liutasil501/ai-api-prices/main/ai-api-prices.json \
  | jq '[.prices[] | select(.model_slug=="gpt-oss-120b")] | sort_by(.input_usd_per_1m_tokens) | .[] | {provider, input_usd_per_1m_tokens, output_usd_per_1m_tokens}'
```

**Python / pandas**

```python
import pandas as pd

prices = pd.read_csv("https://raw.githubusercontent.com/Liutasil501/ai-api-prices/main/ai-api-prices.csv")
llm = prices[prices.category == "text"]
print(llm.groupby("model")["provider"].nunique().sort_values(ascending=False).head(10))
```

**JavaScript**

```js
const { prices } = await fetch("https://raw.githubusercontent.com/Liutasil501/ai-api-prices/main/ai-api-prices.json").then((r) => r.json());
const cheapest = prices.filter((p) => p.model_slug === "claude-sonnet-5-5").sort((a, b) => a.input_usd_per_1m_tokens - b.input_usd_per_1m_tokens)[0];
```

**Price history:** the commit history is the price history. `git log -p ai-api-prices.csv` shows every change since tracking started.

## Columns

| Column | Meaning |
|---|---|
| `category` | `text`, `image`, `video`, `transcription`, `tts`, `search`, `embedding` |
| `model`, `model_slug` | Model name and a stable slug |
| `provider`, `provider_id`, `provider_type` | Who sells it: `first_party`, `cloud` or `inference_host` |
| `input_usd_per_1m_tokens`, `output_usd_per_1m_tokens`, `cached_input_usd_per_1m_tokens` | Token prices |
| `usd_per_image`, `usd_per_video_second`, `usd_per_audio_hour` | Media prices |
| `usd_per_1k_searches`, `usd_per_1m_characters` | Web search (one query, up to 10 results) and text-to-speech |
| `context_tokens`, `variant` | Context window and billing variant, where known |
| `source_url`, `source_dataset` | The provider's pricing page and the open dataset the value came from |
| `first_seen`, `last_changed`, `last_confirmed` | Dates (UTC) |

## How prices get in

Prices come from open, MIT-licensed datasets ([LiteLLM](https://github.com/BerriAI/litellm), [models.dev](https://github.com/sst/models.dev), [Portkey Models](https://github.com/Portkey-AI/models)) and from pricing pages checked by hand. Before a value is published it has to pass guards:

- it must appear on two consecutive daily runs,
- large jumps and zero prices are held back for review,
- every provider is classified by hand (resellers and gateways are not listed as providers),
- prices billed in euros are converted to US dollars at the European Central Bank's daily rate.

These are standard list prices, not quotes. Batch, committed-use and negotiated discounts are not included. Check the provider's page before you buy. The full method is on the [methodology page](https://aiselect.online/methodology).

## License and credit

MIT. If you publish something built on this data, please credit **AISelect.online** and link <https://aiselect.online/open-data>. The source datasets and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Found a wrong price? [Open an issue](https://github.com/Liutasil501/ai-api-prices/issues) with a link to the provider's pricing page.
