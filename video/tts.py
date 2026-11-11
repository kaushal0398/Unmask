"""Step 1: narration audio for every scene, plus durations.json (the recorder paces itself to these).
Usage: python3 tts.py   (needs internet for edge-tts; uses the edge-tts in ~/Desktop/uyk-hack/ryo/video/.venv or any on PATH)"""
import json, os, shutil, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); os.chdir(D); os.makedirs("audio", exist_ok=True)
EDGE = os.environ.get("EDGE_TTS") or shutil.which("edge-tts") or os.path.expanduser("~/Desktop/uyk-hack/ryo/video/.venv/bin/edge-tts")
VOICE = sys.argv[1] if len(sys.argv) > 1 else "en-US-EmmaNeural"
dur = lambda f: float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]).decode())
out = {}
for s in json.load(open("scenes.json")):
    i = s["id"]
    subprocess.run([EDGE,"--voice",VOICE,"--rate=-6%","--text",s["say"],"--write-media",f"audio/{i}.mp3"],check=True,capture_output=True)
    subprocess.run(["ffmpeg","-v","error","-y","-i",f"audio/{i}.mp3","-ar","44100","-ac","2",f"audio/{i}.wav"],check=True); os.remove(f"audio/{i}.mp3")
    out[i] = round(dur(f"audio/{i}.wav"), 2); print(i, out[i])
json.dump(out, open("durations.json","w"), indent=1)
print("total speech", round(sum(out.values()),1), "s")
