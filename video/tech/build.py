"""Technical video: cards built from REAL captured data (data.json) + narration -> Unmask-Tech.mp4 / .srt.
Run:  python3 tts.py   (narration)   then   python3 build.py   (needs data.json from `npx tsx video/tech/capture.mts`)."""
import html, json, os, re, subprocess
D = os.path.dirname(os.path.abspath(__file__)); os.chdir(D)
CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FPS = 30; GAP = 0.6
for d in ("cards", "build"): os.makedirs(d, exist_ok=True)
scenes = json.load(open("scenes.json")); durs = json.load(open("durations.json")); X = json.load(open("data.json"))
LOGO = f"file://{os.path.abspath('../../public/logo.svg')}"
esc = html.escape
def cut(s, n): s = str(s); return s if len(s) <= n else s[:n] + "…"
def trunc(o, n=64):
    if isinstance(o, dict): return {k: trunc(v, n) for k, v in o.items()}
    if isinstance(o, list): return [trunc(v, n) for v in o]
    return cut(o, n) if isinstance(o, str) else o
def hl(text):
    t = esc(text)
    t = re.sub(r'(&quot;)([^&\n]*?)(&quot;)(\s*:)', r'<i class="k">\1\2\3</i>\4', t)
    t = re.sub(r'(:\s*)(&quot;[^\n]*?&quot;)(,?)$', r'\1<i class="s">\2</i>\3', t, flags=re.M)
    t = re.sub(r'(:\s*)(-?\d[\d.]*)(,?)$', r'\1<i class="n">\2</i>\3', t, flags=re.M)
    return t
js = lambda o, n=64: json.dumps(trunc(o, n), indent=2, ensure_ascii=False)
CSS = """*{box-sizing:border-box;margin:0}body{width:1600px;height:900px;background:#000;color:#fff;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;position:relative;overflow:hidden;padding:46px 64px}
.tag{display:inline-flex;gap:10px;align-items:center;font:600 18px ui-monospace,Menlo,monospace;letter-spacing:.18em;padding:8px 16px;border:1px solid #E501A5;color:#ff6fd0;background:rgba(229,1,165,.12)}
h2{font-size:50px;letter-spacing:-.03em;margin:16px 0 22px}
.row{display:flex;gap:22px;align-items:stretch}.col{display:flex;flex-direction:column;gap:18px}
.panel{border:1px solid rgba(255,255,255,.22);background:#0b0b0b;padding:16px 20px;flex:1;min-width:0}
.lab{word-break:break-all;font:600 16px ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#ff6fd0;margin-bottom:10px;text-transform:uppercase}
pre{font:20px/1.42 ui-monospace,Menlo,monospace;color:#e8e8ea;white-space:pre-wrap;word-break:break-all}
pre i{font-style:normal}.k{color:#9db6ff}.s{color:#7ee0a8}.n{color:#ffcb6b}
.note{font-size:26px;line-height:1.35;color:#d0d0d6}.note b{color:#fff}
ul.l{list-style:none;display:flex;flex-direction:column;gap:14px}ul.l li{font-size:27px;line-height:1.3;padding-left:30px;position:relative}ul.l li:before{content:'';position:absolute;left:0;top:11px;width:13px;height:13px;background:#E501A5}
.mid{display:flex;align-items:center;justify-content:center;font:600 20px ui-monospace,Menlo,monospace;color:#E501A5;text-align:center;width:190px;flex:none;flex-direction:column;gap:8px}
.chip{display:inline-block;font:700 17px ui-monospace,Menlo,monospace;padding:5px 12px;letter-spacing:.08em}
.ok{background:rgba(52,211,153,.16);color:#6ee7b7;border:1px solid #34d399}.no{background:rgba(251,191,36,.14);color:#fcd34d;border:1px solid #f59e0b}.bad{background:rgba(248,113,113,.14);color:#fca5a5;border:1px solid #f87171}
table{border-collapse:collapse;width:100%;font:21px ui-monospace,Menlo,monospace}td,th{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.14);text-align:left}th{color:#ff6fd0;font-size:15px;letter-spacing:.12em}
.box{border:1.5px solid #fff;background:#0b0b0b;padding:18px 22px;font-size:25px;line-height:1.3}.box small{display:block;font-size:19px;color:#b0b0b8;margin-top:6px}.dash{border-style:dashed;border-color:#E501A5;color:#ffb3ea}
.arr{display:flex;align-items:center;justify-content:center;font:600 18px ui-monospace,Menlo,monospace;color:#E501A5;flex-direction:column;width:150px;flex:none;text-align:center;gap:4px}
.tile{border:1px solid rgba(255,255,255,.22);background:#0b0b0b;padding:22px 24px;flex:1}.tile b{display:block;font-size:56px;color:#E501A5;letter-spacing:-.03em}.tile span{font-size:23px;color:#d0d0d6}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:26px;padding:0 60px}h1{font-size:150px;letter-spacing:-.05em;line-height:1}p.sub{font-size:42px;color:#b4b4bb;max-width:1200px;line-height:1.3}
"""
head = lambda tag, title: f'<span class="tag">{esc(tag)}</span><h2>{esc(title)}</h2>'
panel = lambda lab, inner, flex=1: f'<div class="panel" style="flex:{flex}"><div class="lab">{esc(lab)}</div>{inner}</div>'
code = lambda text: f'<pre>{hl(text)}</pre>'
bullets = lambda xs: '<ul class="l">' + "".join(f"<li>{x}</li>" for x in xs) + "</ul>"
mid = lambda *l: '<div class="mid">' + "<br>".join(l) + "</div>"
usd = lambda a, dec=6: f"${int(a) / 10**dec:,.4g}" if int(a) < 1e8 else f"${int(a) / 10**dec:,.0f}"
res = X["result"]["result"]; out = res["outcome"]; sealed = X["sealed"]

def title_card(sub): return f'<div class="center"><img src="{LOGO}" width="130"><h1>Unmask</h1><p class="sub">{esc(sub)}</p></div>'
def fillrows(n=6):
    rows = "".join(f'<tr><td>{esc(f["bidder"])}</td><td>{usd(f["limitPrice"])}</td><td>{int(f["requested"]):,}</td><td>{int(f["filled"]):,}</td><td>{usd(f["payment"])}</td><td>{usd(f["refund"])}</td></tr>' for f in out["fills"][:n])
    return f'<table><tr><th>BIDDER</th><th>LIMIT</th><th>WANTED</th><th>GOT</th><th>PAID</th><th>REFUND</th></tr>{rows}</table>'
def chip(status): return {"pass": '<span class="chip ok">PASS</span>', "unchecked": '<span class="chip no">NOT CHECKED</span>', "fail": '<span class="chip bad">FAIL</span>'}[status]
http = lambda r: f'{r["method"]} {r["path"]}'
resp = lambda r: f'HTTP {r["status"]}\n' + js(r["response"], 60)

BODY = {
"t01": lambda: title_card("How a bid is signed in, sealed, settled and checked. Real data from a real run."),
"t02": lambda: head("ARCHITECTURE", "Who holds what") + f'''
<div class="row" style="height:470px;align-items:stretch">
 <div class="box" style="flex:1.1">Browser (Next.js)<small>seal bids (libsodium)<br>verify results (TypeScript rule, SHA-256)<br>wallet sign-in (NEP-413)</small></div>
 <div class="arr">sealed bid<br>→<br>public result<br>←</div>
 <div class="box" style="flex:1.1">Backend (Fastify + PostgreSQL)<small>stores ciphertext + commitment<br>public: launches, counts, results<br>settlement route (creator only)</small></div>
 <div class="arr">ciphertext<br>→<br>fills + hashes<br>←</div>
 <div class="box" style="flex:1.2">Development enclave<small>holds the enclave key<br>opens bids, re-checks rules<br>runs the Rust auction engine (u128, native or WASM)</small></div>
</div>
<div class="row" style="margin-top:20px">
 <div class="box" style="flex:1">NEAR RPC<small>sign-in key check</small></div>
 <div class="box" style="flex:1">NEAR Intents<small>live price quotes (preview)</small></div>
 <div class="box dash" style="flex:1">OutLayer TDX enclave<small>NOT DONE: real attestation</small></div>
 <div class="box dash" style="flex:1">Token + payment locks<small>NOT DONE: stand-ins today</small></div>
</div>''',
"t03": lambda: head("STEP 1", "Sign in with NEP-413") + f'''<div class="row">{panel("POST /v1/auth/challenge  (real response)", code(f"HTTP {X['challenge']['status']}\n" + js(X["challenge"]["response"], 78)), 1.25)}
{panel("What happens next", bullets(["The wallet signs the <b>message</b> (NEP-413)","Backend verifies the signature","NEAR RPC: is the key a <b>full-access key</b> on the account?","Session token issued (24 h)","Challenge is single use, expires in 5 min"]))}</div>''',
"t04": lambda: head("STEP 2", "Lock funds: the payment check") + f'''<div class="row">{panel(http(X["paymentCheck"]), code(js(X["paymentCheck"]["request"])))}
{panel("Response", code(resp(X["paymentCheck"])), 1.5)}</div><p class="note" style="margin-top:22px">$0.05 × 100,000 tokens = $5,000 = <b>5000000000</b> atomic units (6 decimals). The <b>claimKey</b> goes inside the sealed bid, never to the backend. Today the check is a database row: <b>DEVELOPMENT MOCK ONLY</b>.</p>''',
"t05": lambda: head("STEP 3", "Seal the bid in the browser") + f'''<div class="row">{panel("Plaintext bid (never leaves the browser)", code(js(X["plaintext"], 50)))}
{mid("crypto_box_seal(","enclave key","e5d04838…)")}
{panel("What is sent: base64 sealed box", f'<pre style="color:#7ee0a8">{esc(cut(sealed["ciphertext"], 330))}</pre><p class="note" style="margin-top:14px">{len(sealed["ciphertext"])} base64 characters. X25519 + XSalsa20-Poly1305 with a fresh ephemeral key. Only the enclave secret key opens it.</p>')}</div>''',
"t06": lambda: head("STEP 3b", "The commitment") + f'''<div class="col">{panel("What is hashed (fixed order, claim key left out)", code("SHA-256( " + X["commitmentInput"] + " )"))}
{panel("Commitment sent with the bid", f'<pre style="color:#ffcb6b">{esc(sealed["commitment"])}</pre>')}
<p class="note">The salt makes the amounts unguessable from the hash. Show the salt later and anyone can recompute the hash: proof the bid was yours.</p></div>''',
"t07": lambda: head("STEP 4", "Submit, and what the backend keeps") + f'''<div class="row">{panel(http(X["submit"]), code(js({k: v for k, v in X["submit"]["request"].items() if k in ("ciphertext", "commitment", "paymentCheckId", "keyId")}, 40) + "\n→ " + js(X["submit"]["response"])))}
{panel("The stored row (PostgreSQL)", code(js(X["dbRow"], 34)))}
{panel("Public launch view", code(js({k: X["publicAfter"]["launch"].get(k) for k in ("status", "bidCount", "supplyAtomic", "reserveAtomic", "closesAt")}, 30)))}</div><p class="note" style="margin-top:18px">No limit, no quantity, anywhere. <b>bidCount</b> is public by design, and it leaks demand over time.</p>''',
"t08": lambda: head("GUARDS", "What the API refuses (real responses)") + "".join(f'<div class="row" style="margin-bottom:14px"><div class="panel" style="flex:1"><pre>{esc(http(r))}</pre></div><div class="panel" style="flex:1.2"><pre>{hl("HTTP %d  %s" % (r["status"], r["response"]["error"]["code"]))}</pre></div></div>' for r in (X["rejectNoAuth"], X["rejectPlaintext"], X["rejectDuplicate"], X["rejectClosed"])) + '<p class="note">Honest limit: the plaintext guard only rejects text that starts with <b>{</b>. It cannot tell a real sealed box from other opaque text.</p>',
"t09": lambda: head("HONESTY", "The development enclave can read every bid") + f'''<div class="row">{panel("Dev enclave opening the bid we just sealed", code(js(X["devEnclaveOpens"], 50)))}
{panel("What that means", bullets(["The backend holds the enclave key today","So the <b>operator can read bids</b>","Goal: a key that exists only inside attested hardware","Not built yet. Said plainly in PRIVACY_THREAT_MODEL.md"]))}</div>''',
"t10": lambda: head("STEP 5", "Settlement") + f'''<div class="row">{panel("POST /v1/launches/:id/settle", bullets(["<b>Creator only</b>, only after the window closes","Enclave opens every bid","Agent rules re-checked, payout addresses validated","Bad bids left out <b>with a reason</b>","Rest go to the engine as canonical strings (no floats)"]))}
{panel("Left out in this run (real)", code(js(out["skipped"], 90)), 1.3)}</div>''',
"t11": lambda: head("THE RULE", "Uniform price, exact integers") + f'''<div class="row">{panel("Algorithm (AUCTION_SPEC.md)", bullets(["Keep bids with limit ≥ reserve","Sort by limit, high to low","Walk down until the supply is reached: that limit is the <b>clearing price</b>","Above it: filled in full. At it: pro-rata","Everyone pays the clearing price, rounded <b>up</b>","u128 with 256-bit intermediates"]), 1)}
{panel("Real fills  ·  clearing price " + usd(out["clearingPrice"]), fillrows(7), 1.35)}</div>''',
"t12": lambda: head("EVIDENCE", "Three hashes, and what they prove") + "".join(panel(l, f'<pre style="color:#ffcb6b">{esc(v)}</pre><p class="note" style="margin-top:6px;font-size:22px">{n}</p>') + '<div style="height:14px"></div>' for l, v, n in (("inputHash", res["inputHash"], "SHA-256 of the canonical engine input. Anyone can recompute it."), ("codeHash", res["codeHash"], "Identifies the engine that ran. Only a claim until hardware signs it."), ("engineOutputHash", out["engineOutputHash"], "SHA-256 of exactly what the engine wrote. Anyone can recompute it."))) + f'<p class="note">mode = <b>{esc(res["mode"])}</b> · attestation = <b>{esc(str(res["attestation"] or "none").lower())}</b> · engine = <b>{esc(out["engineKind"])}</b></p>',
"t13": lambda: head("STEP 6", "Verify in the browser: six checks") + "<table><tr><th>CHECK</th><th>RESULT</th><th>WHAT IT RECOMPUTES</th></tr>" + "".join(f'<tr><td>{esc(c["title"])}</td><td>{chip(c["status"])}</td><td style="font:21px -apple-system,Arial">{esc(w)}</td></tr>' for c, w in zip(sorted(X["verify"], key=lambda c: ["input", "result", "money", "output", "code", "attestation"].index(c["id"])), ("Rebuild the input from public numbers, hash it", "Run the rule again in TypeScript, compare every fill", "Locked = paid + refunded, to the last unit", "Published output = what the engine wrote", "Needs the published build: cannot from here", "Needs hardware: cannot from here"))) + "</table>",
"t14": lambda: head("ON-CHAIN & INTEGRATIONS", "What is real and what is not") + "<table><tr><th>PART</th><th>STATUS</th><th>DETAIL</th></tr>" + "".join(f"<tr><td>{a}</td><td>{chip_}</td><td style='font:21px -apple-system,Arial'>{d}</td></tr>" for a, chip_, d in (
  ("NEAR sign-in (NEP-413)", '<span class="chip ok">REAL</span>', "Signature check plus a full-access key check over NEAR RPC"),
  ("NEAR Intents quote", '<span class="chip ok">REAL</span>', f"Live: pay {X['quote']['response']['quote']['amountInFormatted']} USDC on Arbitrum for 5 USDC on NEAR. Preview only, no deposit address"),
  ("Rust engine → WASM", '<span class="chip ok">REAL</span>', "Builds to wasm32-wasip2, runs under wasmtime, matches TypeScript on 212 cases"),
  ("OutLayer remote run", '<span class="chip no">NOT VERIFIED</span>', "Not retried yet. Nothing is called attested"),
  ("Enclave key custody", '<span class="chip no">STAND-IN</span>', "Backend holds the key (development enclave)"),
  ("Token and payment locks", '<span class="chip no">STAND-IN</span>', "No token contract, no funds locked, no funds moved"))) + "</table>",
"t15": lambda: head("TESTING", "How it is checked") + '<div class="row" style="margin-bottom:20px">' + "".join(f'<div class="tile"><b>{a}</b><span>{b}</span></div>' for a, b in (("212","shared cases: Rust, WASM and TypeScript agree"),("10","guarantees checked by seeded property tests"),("133","frontend unit tests"))) + '</div><div class="row">' + "".join(f'<div class="tile"><b>{a}</b><span>{b}</span></div>' for a, b in (("64","backend tests"),("27","browser tests (Playwright)"),("31","privacy checks: what the API exposes"))) + '</div><p class="note" style="margin-top:22px">Plus mutation checks (a broken rule must make the tests fail) and a secret scan of the repository and its history.</p>',
"t16": lambda: title_card("Seal in the browser. One exact price. Anyone can recompute. Where it cannot be proven, it says not checked."),
}

ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def srt_time(t):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")
clips, cues, clock = [], [], 0.0
for s in scenes:
    i = s["id"]; speech = durs[i]; d = speech + GAP
    open(f"cards/{i}.html", "w").write(f"<html><head><style>{CSS}</style></head><body>{BODY[i]()}</body></html>")
    subprocess.run([CH, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1600,900", "--force-device-scale-factor=1", "--allow-file-access-from-files", f"--screenshot=cards/{i}.png", f"file://{D}/cards/{i}.html"], capture_output=True, check=True)
    tail = f"scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.3,fade=t=out:st={d-0.3:.2f}:d=0.3,format=yuv420p"
    ff("-loop", "1", "-t", f"{d:.2f}", "-r", str(FPS), "-i", f"cards/{i}.png", "-i", f"audio/{i}.wav", "-filter_complex", f"[0:v]{tail}[v]", "-map", "[v]", "-map", "1:a",
       "-af", f"apad=pad_dur={GAP}", "-t", f"{d:.2f}", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS), "-c:a", "aac", "-b:a", "160k", f"build/{i}.mp4")
    clips.append(f"build/{i}.mp4")
    sents = [x for x in re.split(r"(?<=[.!?:])\s+", s["say"]) if x]; tot = sum(len(x) for x in sents); t = clock + 0.3
    for x in sents:
        span = speech * len(x) / tot; cues.append((t, t + span, x)); t += span
    clock += d
open("build/list.txt", "w").write("".join(f"file '{os.path.basename(c)}'\n" for c in clips))
ff("-f", "concat", "-safe", "0", "-i", "build/list.txt", "-c:v", "copy", "-af", "highpass=f=70,lowpass=f=9000,loudnorm=I=-17:TP=-2:LRA=7", "-c:a", "aac", "-b:a", "192k", "Unmask-Tech.mp4")
open("Unmask-Tech.srt", "w").write("".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{x}\n\n" for n, (a, b, x) in enumerate(cues, 1)))
print(f"done: {clock:.1f}s")
