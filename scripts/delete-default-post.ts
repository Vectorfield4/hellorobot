const endpoint = "https://hello-robot.ru/graphql";
const username = "admin";
const password = process.env.HELLOROBOT_APP_PASSWORD;
if (!password) {
  console.error("env missing");
  process.exit(1);
}
const auth = Buffer.from(`${username}:${password}`).toString("base64");

async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: { post?: { id: string; slug: string } }; errors?: unknown };
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? res.status));
  return json.data;
}

const data = await gql(`query { post(id: "привет-мир", idType: SLUG) { id slug } }`);
if (!data?.post) {
  console.log("default post not found");
  process.exit(0);
}
await gql(`mutation DeletePost($id: ID!) { deletePost(input: { id: $id }) { deletedId } }`, {
  id: data.post.id,
});
console.log(`deleted: ${data.post.slug}`);
