# AI API Prices (Agent Guide)

Public MIT-licensed AI API pricing dataset (`ai-api-prices.json`, `ai-api-prices.csv`) and MCP server (`mcp/server.js`).

## Quick Commands
- Run tests: `npm test` (`node --test mcp/prices.test.js`)
- Run smoke check: `npm run smoke` (`node mcp/smoke.mjs`)
- Start MCP server (stdio): `npm start` (`node mcp/server.js`)

## Conventions
- Keep all code, docs, and commits in English.
- Preserve existing comments and docstrings unrelated to your changes.
- Keep commits and docs strictly public-safe (no personal local paths, private server details, or secrets).
- Never use em or en dashes anywhere in code, docs, or commits; use hyphens, colons, or parentheses instead.
- Verify `npm test` and `npm run smoke` pass after any pricing data or MCP server changes.
