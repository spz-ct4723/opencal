/**
 * Local stdio probe for the HTTP MCP route. It is not a Vercel function:
 * serverless cannot host a long-running process. Run it on the mini or a
 * laptop and set OPENCAL_URL to the deployment origin.
 * The default bearer "demo" is accepted by /api/mcp only when DEMO_MODE=true.
 * Leave DEMO_MODE unset in production.
 */
const BASE = process.env.OPENCAL_URL || "http://localhost:3000";
const TOKEN = process.env.OPENCAL_MCP_TOKEN || "demo";

async function call(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method, params }),
  });
  return res.json();
}

async function main() {
  const tools = await call("tools/list");
  console.log("OpenCal MCP tools:", JSON.stringify(tools, null, 2));
  const events = await call("list_events", {});
  console.log(
    "Sample events:",
    Array.isArray(events.events) ? events.events.length : events
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
