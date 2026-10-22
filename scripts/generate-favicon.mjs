const API = "https://api.runware.ai/v1";
const apiKey = process.env.RUNWARE_API_KEY ?? process.env.OPENCODE_RUNWARE_API_KEY;
if (!apiKey) {
  console.error("RUNWARE_API_KEY is not set");
  process.exit(1);
}

const prompt = `Minimalist flat icon of a friendly robot head, geometric shapes, white on dark charcoal background, simple, high contrast, no text, square composition, centered, clean vector style, favicon, 512x512`;

const negativePrompt = `text, letters, words, photo, 3D render, gradients, colorful, busy background, watermark, mockup, people, hands, complex details`;

async function generate(width, height, seed) {
  const body = [
    {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      model: "runware:5@1",
      positivePrompt: prompt,
      negativePrompt,
      width,
      height,
      steps: 25,
      CFGScale: 4,
      seed,
    },
  ];
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data?.[0]?.imageURL;
}

const fs = await import("node:fs");
const out = await generate(512, 512, 7);
console.log("imageURL:", out);
const img = await fetch(out);
const buf = Buffer.from(await img.arrayBuffer());
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/favicon.png", buf);
console.log("saved: public/favicon.png", buf.length, "bytes");
