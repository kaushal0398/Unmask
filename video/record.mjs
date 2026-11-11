// Step 2: screen-record every "clip" scene from the real running app, paced to the narration in durations.json.
// Needs: web app on :3000, backend on :4001, an OPEN demo launch id in OPEN_ID, DATABASE_URL etc. for seeding the closed one.
//   OPEN_ID=<id> node video/record.mjs [sceneId ...]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const D = dirname(fileURLToPath(import.meta.url));
const ROOT = join(D, "..");
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const OPEN_ID = process.env.OPEN_ID;
if (!OPEN_ID) throw new Error("set OPEN_ID to an open demo launch id");
const dur = JSON.parse(readFileSync(join(D, "durations.json"), "utf8"));
const only = process.argv.slice(2);
mkdirSync(join(D, "clips"), { recursive: true });
const ARB = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// seed one closed launch now so the settle scene is real
function seedClosed() {
  const out = execFileSync("npm", ["run", "seed:demo", "--", "--creator", "demo.testnet", "--bidder", "demo.testnet"], { cwd: join(ROOT, "backend"), encoding: "utf8" });
  const m = out.match(/\/launches\/([a-z0-9]+)/);
  if (!m) throw new Error("could not read the closed launch id:\n" + out);
  return m[1];
}
const settle = (id) => execFileSync("npm", ["run", "settle:demo", "--", id], { cwd: join(ROOT, "backend"), encoding: "utf8" });

const CURSOR = `(()=>{ if (window.__c) return;
 const add=()=>{ if(!document.body) return requestAnimationFrame(add);
  const s=document.createElement('style'); s.textContent='nextjs-portal{display:none!important}#__cur{position:fixed;z-index:2147483647;left:0;top:0;width:24px;height:24px;pointer-events:none;transition:transform .08s linear}#__cur svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.7))}.__rip{position:fixed;z-index:2147483646;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #E501A5;pointer-events:none;animation:__r .55s ease-out forwards}@keyframes __r{to{transform:scale(3.4);opacity:0}}';
  document.head.appendChild(s);
  const c=document.createElement('div'); c.id='__cur'; c.style.transform='translate(1400px,820px)';
  c.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c); window.__c=c;
  addEventListener('mousemove',e=>{c.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)'},true);
  addEventListener('mousedown',e=>{const r=document.createElement('div'); r.className='__rip'; r.style.left=e.clientX+'px'; r.style.top=e.clientY+'px'; document.body.appendChild(r); setTimeout(()=>r.remove(),700)},true);
 }; add(); })()`;

async function run(browser, id, { url, prep, steps }) {
  const L = dur[id] + 1.4; // a little longer than the narration; the build trims it
  const raw = join(D, "raw", id); rmSync(raw, { recursive: true, force: true }); mkdirSync(raw, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, recordVideo: { dir: raw, size: { width: 1600, height: 900 } } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const created = Date.now();
  await page.goto(WEB + url, { waitUntil: "networkidle" });
  if (prep) await prep(page);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
  const t0 = Date.now();
  const ctl = {
    page,
    async click(loc) { loc = typeof loc === "function" ? loc(page) : loc; await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 28 }); await sleep(200); await page.mouse.down(); await page.mouse.up(); await sleep(250); },
    async type(loc, text) { loc = typeof loc === "function" ? loc(page) : loc; await ctl.click(loc); await loc.fill(""); await loc.pressSequentially(text, { delay: 70 }); },
    async scrollTo(loc, ms = 1400) { loc = typeof loc === "function" ? loc(page) : loc; await loc.evaluate((el, ms) => new Promise((res) => { const r = el.getBoundingClientRect(); const target = Math.max(0, scrollY + r.top - 140); const from = scrollY, t = performance.now(); const f = (n) => { const k = Math.min(1, (n - t) / ms), e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2; scrollTo(0, from + (target - from) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), ms); },
    async pan(ms, frac = 1) { await page.evaluate(([ms, frac]) => new Promise((res) => { const max = (document.documentElement.scrollHeight - innerHeight) * frac, from = scrollY, t = performance.now(); const f = (n) => { const k = Math.min(1, (n - t) / ms); scrollTo(0, from + (max - from) * k); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), [ms, frac]); },
  };
  for (const [frac, fn] of steps) {
    const wait = frac * dur[id] * 1000 - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    await fn(ctl);
  }
  const rest = L * 1000 - (Date.now() - t0); if (rest > 0) await sleep(rest);
  const trim = ((t0 - created) / 1000 + 0.1).toFixed(2);
  await page.close(); await ctx.close();
  const webm = join(raw, execFileSync("ls", [raw], { encoding: "utf8" }).trim().split("\n")[0]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", trim, "-i", webm, "-t", L.toFixed(2), "-vf", "fps=30,scale=1600:900,format=yuv420p", "-c:v", "libx264", "-crf", "18", "-preset", "medium", join(D, "clips", id + ".mp4")]);
  console.log("recorded", id, L.toFixed(1) + "s");
}

const demoWallet = async (p) => { await p.getByRole("button", { name: "use demo wallet" }).first().click(); await p.getByLabel("Limit price per token in dollars").waitFor(); };
const limit = (p) => p.getByLabel("Limit price per token in dollars");

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const closedId = seedClosed(); console.log("closed launch", closedId);
const SCENES = {
  "04-race": { url: "/", steps: [[0.05, (c) => c.scrollTo((p) => p.getByText("Same eleven bids. Two launches."), 1500)], [0.3, (c) => c.click((p) => p.getByRole("button", { name: /Replay/ }))]] },
  "05-open": { url: `/launches/${OPEN_ID}`, prep: demoWallet, steps: [[0.45, (c) => c.scrollTo(limit, 1500)], [0.7, (c) => c.type(limit, "0.05")]] },
  "06-agent": { url: `/launches/${OPEN_ID}`, prep: demoWallet, steps: [[0.05, (c) => c.scrollTo(limit, 1200)], [0.2, (c) => c.click((p) => p.getByLabel(/Let an agent place this bid/i))], [0.5, (c) => c.click((p) => p.getByRole("button", { name: /Set the rules/i }))], [0.62, (c) => c.scrollTo((p) => p.getByTestId("agent-summary"), 1200)]] },
  "07-payout": { url: `/launches/${OPEN_ID}`, prep: demoWallet, steps: [[0.03, (c) => c.scrollTo(limit, 1200)], [0.12, (c) => c.click((p) => p.getByLabel(/Send my refund and tokens somewhere else/i))], [0.2, async (c) => { await c.page.getByLabel("Refund chain").selectOption("arb"); }], [0.3, (c) => c.type((p) => p.getByLabel("Refund address"), "0x123")], [0.6, (c) => c.type((p) => p.getByLabel("Refund address"), ARB)], [0.82, (c) => c.type((p) => p.getByLabel("Token address"), "Not A Name")]] },
  "08-funding": { url: `/launches/${OPEN_ID}`, prep: demoWallet, steps: [[0.03, (c) => c.scrollTo(limit, 1200)], [0.12, (c) => c.click((p) => p.getByRole("button", { name: /Pay from another chain/i }))], [0.3, (c) => c.type((p) => p.getByLabel("Refund address on the paying chain"), ARB)], [0.55, (c) => c.click((p) => p.getByRole("button", { name: /Get a price for/i }))], [0.75, (c) => c.scrollTo((p) => p.getByTestId("funding-quote"), 1200)]] },
  "09-closed": { url: `/launches/${closedId}`, steps: [[0.05, (c) => c.pan(5000)], [0.5, async () => { settle(closedId); }], [0.8, async (c) => { await c.page.reload({ waitUntil: "networkidle" }); }]] },
  "10-result": { url: `/launches/${closedId}`, steps: [[0.02, (c) => c.pan(dur["10-result"] * 800, 0.72)]] },
  "11-verify": { url: `/launches/${closedId}`, steps: [[0.04, (c) => c.click((p) => p.getByRole("link", { name: /Verify this launch/ }).first())], [0.2, (c) => c.click((p) => p.getByRole("button", { name: /run the checks/i }))], [0.45, (c) => c.scrollTo((p) => p.getByTestId("verify-check").first(), 1500)], [0.72, (c) => c.click((p) => p.getByTestId("verify-check").first())]] },
  "12-cheat": { url: "/verify", steps: [[0.08, (c) => c.click((p) => p.getByRole("button", { name: /PixelPup/ }))], [0.28, (c) => c.click((p) => p.getByLabel(/Pretend someone cheated/i))], [0.48, (c) => c.click((p) => p.getByRole("button", { name: /run the checks/i }))], [0.68, (c) => c.scrollTo((p) => p.getByText(/checks (failed|passed)/).first(), 1400)]] },
  "13-tour": { url: "/launches", steps: [[0.38, async (c) => { await c.page.goto(WEB + "/launches/new", { waitUntil: "networkidle" }); }], [0.7, async (c) => { await c.page.goto(WEB + "/compare", { waitUntil: "networkidle" }); }]] },
};
for (const [id, def] of Object.entries(SCENES)) if (!only.length || only.includes(id)) await run(browser, id, def);
await browser.close();
