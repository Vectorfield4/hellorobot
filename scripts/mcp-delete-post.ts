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

const postId = Number(process.argv[2]);
if (!postId) { console.error("usage: node script.ts <post_id>"); process.exit(1); }

let sid: string | undefined;
const init = await mcp("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "opencode", version: "1.0" } });
sid = init.sessionId;

const deleteRes = await mcp("tools/call", {
  name: "mcp-adapter-execute-ability",
  arguments: {
    ability_name: "ewpa/delete-post",
    parameters: { post_id: postId, force_delete: true },
  },
}, sid);

const text = deleteRes.data?.content?.[0]?.text;
console.log(text ? JSON.parse(text) : deleteRes.data);