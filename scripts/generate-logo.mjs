const API = "https://api.runware.ai/v1";
const apiKey = process.env.RUNWARE_API_KEY ?? process.env.OPENCODE_RUNWARE_API_KEY;
if (!apiKey) {
  console.error("RUNWARE_API_KEY is not set");
  process.exit(1);
}

const prompt = `Minimalist tech wordmark logo for a robotics news site: the word "hellorobot" in clean geometric sans-serif lowercase letters, white text on dark charcoal background (#1f1f1f). A small friendly robot head icon integrated before the text, same white color, flat vector style, crisp edges, generous horizontal padding, centered composition, high contrast, professional tech branding, no gradients, no shadows, no photo elements.`;

const negativePrompt = `misspelled text, extra letters, blurry, photo, 3D render, gradients, colorful, busy background, multiple words, tagline, watermark, mockup, people, hands`;

async function generate(width, height, seed) {
  const body = [
    {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      model: "runware:400@1",
      positivePrompt: prompt,
      negativePrompt,
      width,
      height,
      steps: 30,
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
const out = await generate(1536, 512, 42);
console.log("imageURL:", out);
const img = await fetch(out);
const buf = Buffer.from(await img.arrayBuffer());
fs.mkdirSync("src/shared/assets/images", { recursive: true });
fs.writeFileSync("src/shared/assets/images/hellorobot-logo.png", buf);
console.log("saved: src/shared/assets/images/hellorobot-logo.png", buf.length, "bytes");
