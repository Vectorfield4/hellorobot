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

const items = [
  { menu: 29, title: "Главная", object: "custom", url: "/" },
  { menu: 29, title: "О проекте", object: "page", object_id: 27 },
  { menu: 29, title: "Робототехника", object: "category", object_id: 3 },
  { menu: 29, title: "ИИ", object: "category", object_id: 4 },
  { menu: 29, title: "Стартапы", object: "category", object_id: 5 },
];

let sid: string | undefined;
const init = await mcp("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "opencode", version: "1.0" } });
sid = init.sessionId;

for (const item of items) {
  const res = await mcp("tools/call", {
    name: "mcp-adapter-execute-ability",
    arguments: { ability_name: "ewpa/add-menu-item", parameters: item },
  }, sid);
  const text = res.data?.content?.[0]?.text;
  const json = text ? JSON.parse(text) : null;
  console.log(item.title, ":", json?.message ?? JSON.stringify(json));
}