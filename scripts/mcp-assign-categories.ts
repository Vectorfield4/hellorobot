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

const assignments: Record<number, { categories: number[]; tags: string[] }> = {
  7: { categories: [3], tags: ["роботы", "новости"] },
  9: { categories: [4, 6], tags: ["роботы", "ИИ", "безопасность", "исследования"] },
  11: { categories: [3], tags: ["Boston Dynamics", "Atlas", "манипуляторы", "железо"] },
  13: { categories: [8, 4], tags: ["тактильность", "манипуляции", "Physical AI", "стартапы"] },
  15: { categories: [5], tags: ["стартапы", "переработка", "Physical AI", "роботы"] },
  17: { categories: [7], tags: ["автономия", "авто", "ИИ", "роботы"] },
  19: { categories: [4, 8], tags: ["ROS 2", "тактильность", "имитационное обучение", "роботы"] },
  21: { categories: [4], tags: ["Google DeepMind", "Physical AI", "гуманоиды", "ИИ"] },
};

let sid: string | undefined;
const init = await mcp("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "opencode", version: "1.0" } });
sid = init.sessionId;

for (const [id, data] of Object.entries(assignments)) {
  const res = await mcp("tools/call", {
    name: "mcp-adapter-execute-ability",
    arguments: { ability_name: "ewpa/update-post", parameters: { post_id: Number(id), categories: data.categories, tags: data.tags } },
  }, sid);
  const text = res.data?.content?.[0]?.text;
  const json = text ? JSON.parse(text) : null;
  console.log(`post ${id}:`, json?.message ?? JSON.stringify(json));
}