"""Step 3: cards + recorded clips + narration -> Unmask-Demo.mp4 and Unmask-Demo.srt.
Run after tts.py and record.mjs.   Usage: python3 build.py   (needs Pillow: pip install pillow, ffmpeg, Google Chrome)"""
import html, json, os, re, subprocess
from PIL import Image

CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
D = os.path.dirname(os.path.abspath(__file__)); os.chdir(D)
FPS = 30; GAP = 0.5; PINK = "#E501A5"
for d in ("cards", "build"): os.makedirs(d, exist_ok=True)
scenes = json.load(open("scenes.json")); durs = json.load(open("durations.json"))
LOGO = f"file://{os.path.abspath('../public/logo.svg')}"
CSS = """*{box-sizing:border-box;margin:0}body{width:1600px;height:900px;background:%s;color:#fff;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;position:relative;overflow:hidden}
.tag{display:inline-flex;align-items:center;gap:10px;font:600 20px ui-monospace,Menlo,monospace;letter-spacing:.2em;padding:10px 20px;border:1px solid #E501A5;color:#ff6fd0;white-space:nowrap;background:rgba(229,1,165,.12)}
.dot{width:10px;height:10px;border-radius:50%%;background:currentColor}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 40px;gap:28px}
h1{font-size:170px;letter-spacing:-.05em;font-weight:700;line-height:1}
p.sub{font-size:44px;color:#b4b4bb;max-width:1200px;line-height:1.3}
h2{font-size:68px;letter-spacing:-.03em}
ul{list-style:none;display:flex;flex-direction:column;gap:20px;text-align:left}
li{font-size:38px;color:#eee;padding:24px 34px;border:1px solid rgba(255,255,255,.18);background:#0c0c0c;display:flex;gap:22px;align-items:center;min-width:900px;max-width:1300px}
li:before{content:'';width:14px;height:14px;background:#E501A5;flex:none}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.05) 1px,transparent 1px);background-size:64px 64px;-webkit-mask-image:radial-gradient(ellipse at center,#000,transparent 70%%)}
.bar{position:absolute;left:0;right:0;bottom:0;height:104px;padding:0 60px;display:flex;align-items:center;gap:24px;background:linear-gradient(to top,rgba(0,0,0,.97) 70%%,rgba(0,0,0,0))}
.brand{margin-left:auto;display:flex;align-items:center;gap:14px;font-size:34px;font-weight:700;letter-spacing:-.03em}
.cap{font-size:40px;font-weight:600;letter-spacing:-.02em}
.steps{display:flex;align-items:stretch;gap:12px}
.step{width:312px;padding:28px 24px;border:1px solid rgba(255,255,255,.2);background:#0c0c0c;text-align:left;display:flex;flex-direction:column;gap:18px}
.num{width:56px;height:56px;border-radius:50%%;background:#E501A5;color:#fff;font-size:32px;font-weight:700;display:flex;align-items:center;justify-content:center}
.step p{font-size:27px;line-height:1.25}
.arrow{align-self:center;font-size:38px;color:#E501A5}
"""
page = lambda body, bg="#000": f"<html><head><style>{CSS % bg}</style></head><body>{body}</body></html>"
tagh = lambda t: f'<span class="tag"><span class="dot"></span>{html.escape(t)}</span>' if t else ""
logo = lambda w: f'<img src="{LOGO}" width="{w}" height="{w}">'

def render(name, doc, transparent=False):
    open(f"cards/{name}.html", "w").write(doc)
    a = [CH, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1600,900", "--force-device-scale-factor=1", "--allow-file-access-from-files"]
    if transparent: a.append("--default-background-color=00000000")
    subprocess.run(a + [f"--screenshot=cards/{name}.png", f"file://{D}/cards/{name}.html"], capture_output=True, check=True)

ff = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)
def srt_time(t):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")

clips, cues, clock = [], [], 0.0
for s in scenes:
    i = s["id"]; speech = durs[i]; d = speech + GAP + (0.4 if s["kind"] == "title" else 0)
    tail = f"scale=1920:1080:flags=lanczos,fade=t=in:st=0:d=0.35,fade=t=out:st={d-0.35:.2f}:d=0.35,format=yuv420p"
    if s["kind"] == "title":
        render(i, page(f'<div class="grid"></div><div class="center">{logo(150)}<h1>{s["title"]}</h1><p class="sub">{html.escape(s["sub"])}</p></div>'))
        inp = ["-loop", "1", "-t", f"{d:.2f}", "-r", str(FPS), "-i", f"cards/{i}.png"]; fc = f"[0:v]{tail}[v]"; aidx = 1
    elif s["kind"] == "list":
        li = "".join(f"<li>{html.escape(x)}</li>" for x in s["items"])
        render(i, page(f'<div class="grid"></div><div class="center" style="gap:34px">{tagh(s["tag"])}<h2>{html.escape(s["title"])}</h2><ul>{li}</ul></div>'))
        inp = ["-loop", "1", "-t", f"{d:.2f}", "-r", str(FPS), "-i", f"cards/{i}.png"]; fc = f"[0:v]{tail}[v]"; aidx = 1
    elif s["kind"] == "steps":
        st = '<div class="arrow">&rarr;</div>'.join(f'<div class="step"><div class="num">{n}</div><p>{html.escape(t)}</p></div>' for n, t in s["items"])
        render(i, page(f'<div class="grid"></div><div class="center" style="gap:44px">{tagh(s["tag"])}<h2>{html.escape(s["title"])}</h2><div class="steps">{st}</div></div>'))
        inp = ["-loop", "1", "-t", f"{d:.2f}", "-r", str(FPS), "-i", f"cards/{i}.png"]; fc = f"[0:v]{tail}[v]"; aidx = 1
    else:
        render(i + "-bar", page(f'<div class="bar">{tagh(s["tag"])}<div class="cap">{html.escape(s["cap"])}</div><div class="brand">{logo(44)}Unmask</div></div>', "transparent"), True)
        inp = ["-i", f"clips/{i}.mp4", "-loop", "1", "-t", f"{d:.2f}", "-r", str(FPS), "-i", f"cards/{i}-bar.png"]
        fc = (f"[0:v]scale=-2:796,pad=1600:900:(ow-iw)/2:0:color=000000,tpad=stop_mode=clone:stop_duration=40,trim=duration={d:.2f},setpts=PTS-STARTPTS[a];"
              f"[a][1:v]overlay=0:0,{tail}[v]"); aidx = 2
    ff(*inp, "-i", f"audio/{i}.wav", "-filter_complex", fc, "-map", "[v]", "-map", f"{aidx}:a", "-af", f"apad=pad_dur={GAP+0.4}", "-t", f"{d:.2f}",
       "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS), "-c:a", "aac", "-b:a", "160k", f"build/{i}.mp4")
    clips.append(f"build/{i}.mp4")
    sents = [x for x in re.split(r"(?<=[.!?:])\s+", s["say"]) if x]; tot = sum(len(x) for x in sents); t = clock + 0.35
    for x in sents:
        span = speech * len(x) / tot; cues.append((t, t + span, x)); t += span
    clock += d

open("build/list.txt", "w").write("".join(f"file '{os.path.basename(c)}'\n" for c in clips))
ff("-f", "concat", "-safe", "0", "-i", "build/list.txt", "-c:v", "copy", "-af", "highpass=f=70,lowpass=f=9000,loudnorm=I=-17:TP=-2:LRA=7", "-c:a", "aac", "-b:a", "192k", "Unmask-Demo.mp4")
open("Unmask-Demo.srt", "w").write("".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{x}\n\n" for n, (a, b, x) in enumerate(cues, 1)))
print(f"done: {clock:.1f}s")
