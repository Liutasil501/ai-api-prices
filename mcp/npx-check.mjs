// Install check: run the server exactly as the README tells users, via npx from GitHub.
//   node mcp/npx-check.mjs [github:Liutasil501/ai-api-prices]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const spec = process.argv[2] ?? "github:Liutasil501/ai-api-prices";
const windows = process.platform === "win32";
const client = new Client({ name: "npx-check", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: windows ? "cmd" : "npx", args: windows ? ["/c", "npx", "-y", spec] : ["-y", spec] }));
const { tools } = await client.listTools();
console.log("tools:", tools.map((tool) => tool.name).join(", "));
const result = await client.callTool({ name: "model_prices", arguments: { model: "llama 3.3 70b" } });
console.log(result.content[0].text.split("\n").slice(0, 4).join("\n"));
await client.close();
