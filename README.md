# AI API prices

A free, daily-updated dataset of AI API list prices: LLMs, image and video generation, speech-to-text, text-to-speech, web search and embeddings, across every provider [AISelect.online](https://aiselect.online/open-data) tracks.

- [`ai-api-prices.json`](ai-api-prices.json): all prices plus attribution metadata
- [`ai-api-prices.csv`](ai-api-prices.csv): the same rows as a spreadsheet

The files are refreshed every day from <https://aiselect.online/data/ai-api-prices.json>. **The commit history is the price history**: `git log -p ai-api-prices.csv` shows every change.

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
| `first_seen`, `last_changed` | Dates (UTC) |

Only prices that passed AISelect's publication guards are included: a value must appear on two consecutive daily runs, large jumps and zero prices are held back, and every provider is classified by hand. These are standard list prices, not quotes; check the provider before you buy.

## Example

```bash
curl -s https://raw.githubusercontent.com/Liutasil501/ai-api-prices/main/ai-api-prices.json \
  | jq '.prices[] | select(.model_slug=="gpt-oss-120b") | {provider, input_usd_per_1m_tokens, output_usd_per_1m_tokens}'
```

Compare the same data interactively, with calculators, at [aiselect.online](https://aiselect.online).

## License

MIT. Please credit "AISelect.online" and link <https://aiselect.online/open-data> when you publish something built on this data. Source datasets and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
