const endpoint = "https://hello-robot.ru/wp-json/mcp/mcp-adapter-default-server";
const username = "admin";
const password = process.env.HELLOROBOT_APP_PASSWORD;
if (!password) { console.error("env missing"); process.exit(1); }
const auth = Buffer.from(`${username}:${password}`).toString("base64");

async function mcp(method: string, params: any, sessionId?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Basic ${auth}` };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
  const sid = res.headers.get("mcp-session-id") ?? sessionId;
  const json = await res.json() as any;
  if (json.error) throw new Error(JSON.stringify(json.error));
  return { data: json.result, sessionId: sid };
}

let sid: string | undefined;
const init = await mcp("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "opencode", version: "1.0" } });
sid = init.sessionId;

const res = await mcp("tools/call", {
  name: "mcp-adapter-execute-ability",
  arguments: {
    ability_name: "ewpa/create-page",
    parameters: { title: "Блог", content: "", status: "publish" },
  },
}, sid);
const text = res.data?.content?.[0]?.text;
const json = text ? JSON.parse(text) : null;
console.log(json);
// set page_for_posts
if (json?.data?.page_id) {
  const auth2 = auth;
  const r = await fetch("https://hello-robot.ru/wp-json/wp/v2/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth2}` },
    body: JSON.stringify({ page_for_posts: json.data.page_id }),
  });
  console.log("settings:", r.status, await r.text());
}