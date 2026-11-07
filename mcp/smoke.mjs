// End-to-end check: start the server over stdio with the official MCP client,
// list the tools and call each one against the live dataset.
//   node mcp/smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("./server.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")] }));
const { tools } = await client.listTools();
console.log("tools:", tools.map((tool) => tool.name).join(", "));
const calls = [
  ["find_models", { query: "claude sonnet" }],
  ["model_prices", { model: "gpt-oss-120b" }],
  ["estimate_monthly_cost", { model: "gpt-oss-120b", input_million_tokens: 10, output_million_tokens: 2 }],
  ["estimate_monthly_cost", { model: "flux", category: "image", units: 1000 }],
  ["compare_models", { model_a: "gpt-6.1 sol", model_b: "claude opus 5.5" }],
  ["cheapest_models", { category: "search", limit: 3 }],
  ["model_prices", { model: "zzzz-not-a-model" }],
];
for (const [name, args] of calls) {
  const result = await client.callTool({ name, arguments: args });
  console.log(`\n### ${name} ${JSON.stringify(args)}\n${result.content.map((part) => part.text).join("\n").split("\n").slice(0, 8).join("\n")}`);
}
await client.close();
