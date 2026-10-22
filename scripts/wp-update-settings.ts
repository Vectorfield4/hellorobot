const endpoint = "https://hello-robot.ru/wp-json/wp/v2/settings";
const username = "admin";
const password = process.env.HELLOROBOT_APP_PASSWORD;
if (!password) { console.error("env missing"); process.exit(1); }
const auth = Buffer.from(`${username}:${password}`).toString("base64");

const body = {
  title: "hellorobot",
  description: "Робототехника: новости, разборы и каталог",
  show_on_front: "page",
  page_on_front: 27,
  default_category: 3,
};

const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
  body: JSON.stringify(body),
});
const json = await res.json();
console.log(res.status, JSON.stringify(json, null, 2));