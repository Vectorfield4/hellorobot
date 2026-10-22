import { postsFixture } from "../src/shared/mocks/fixtures/posts.ts";

const endpoint = "https://hello-robot.ru/graphql";
const username = "admin";
const password = process.env.HELLOROBOT_APP_PASSWORD;

if (!password) {
  console.error("HELLOROBOT_APP_PASSWORD is not set");
  process.exit(1);
}

const auth = Buffer.from(`${username}:${password}`).toString("base64");

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors ?? res.status));
  }
  return json.data as T;
}

const existing = await gql<{ posts: { nodes: { slug: string }[] } }>(
  "query { posts(first: 100) { nodes { slug } } }",
);
const existingSlugs = new Set(existing.posts.nodes.map((n) => n.slug));

for (const post of postsFixture) {
  if (existingSlugs.has(post.slug)) {
    console.log(`skip (exists): ${post.slug}`);
    continue;
  }

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        post { id slug title }
      }
    }
  `;

  try {
    const data = await gql<{ createPost: { post: { id: string; slug: string; title: string } } }>(
      mutation,
      {
        input: {
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          status: "PUBLISH",
          slug: post.slug,
        },
      },
    );
    console.log(`created: ${data.createPost.post.slug} (${data.createPost.post.id})`);
  } catch (error) {
    console.error(
      `failed: ${post.slug} -> ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
