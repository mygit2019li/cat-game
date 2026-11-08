"""Legacy web sourced sound builder (retired).

The active sound pack is extracted from a user-provided recording. Use
tools/extract_soundboard_from_video.py with that video; this old web-source
builder is kept only as historical implementation detail and must not replace
the aligned recordings.

用法：
  python3 tools/build_animal_sounds.py

产物（assets/sounds/）：cat_*.mp3 / dog_*.mp3，共 24 条。
数据源（全部免费可商用）：
  · Mixkit Cat / Dog 分类（Mixkit License，无需署名）：
      https://mixkit.co/free-sound-effects/cat/
      https://mixkit.co/free-sound-effects/dog/
  · Freesound，逐个筛选 CC0（公共领域，无需署名）：
      见每条的 mixkit / freesound 编号，页面地址 https://freesound.org/s/<id>/
  情绪对应关系按素材本身的语义重新核对过：
      「困惑」用 questioning cat meow；「生气/暴躁」用家猫 hiss / growl；
      「惊讶」用 surprised bark / cat scream；「幸福」用 cat/dog purr；
      「饥饿」用 hungry meow / fido is hungry；不再用野生狮吼冒充家猫情绪。

处理：
  1. 截取 start 起 3s（短素材不足 3s 则原样），去首尾静音（-45dB 门限）；
  2. 安静的素材（呼噜/呜咽/喘气）先 afftdn 降噪 + 70Hz~9kHz 带通，避免拉高音量后全是底噪；
  3. loudnorm 测 integrated，按 -16 LUFS 算增益；增益上限 +24dB；
     极短素材（<1s）loudnorm 会因门限测不到，改用 volumedetect 均值对齐到 -16dB；
  4. volume + alimiter 限到 -1.5dBFS，迭代两次让响度收敛；
  5. 首 12ms / 尾 50ms 淡入淡出；
  6. 64kbps 单声道 mp3（24 条合计约 300KB，给 4MB 主包留余量）。
"""
import json
import os
import re
import subprocess
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sounds")
MIXKIT = "https://assets.mixkit.co/active_storage/sfx"
FREESOUND = "https://cdn.freesound.org/previews"
SR = 44100
TARGET_LUFS = -16.0
MAX_GAIN = 24.0

# name: (source, id/path, start, denoise, special)
#   source = "mixkit" -> id 是 Mixkit 素材编号
#   source = "fs"     -> id 是 Freesound 的 "<目录>/<文件名>"，不带 -lq.mp3
SOURCES = {
    # ---------- 猫 ----------
    "cat_angry":    ("fs", "485/485952_7932944",    0.00, False, None),   # Cat Hissing
    "cat_alert":    ("mixkit", 86,                  0.00, False, None),   # Little cat attention meow
    "cat_confused": ("fs", "754/754586_2493710",    0.00, False, None),   # questioning cat meow
    "cat_cry":      ("mixkit", 87,                  0.00, False, None),   # Little cat pain meow
    "cat_happy":    ("mixkit", 93,                  0.00, False, None),   # Sweet kitty meow
    "cat_grumpy":   ("fs", "679/679954_14816633",   0.10, True,  None),   # Cat Growling and Hissing
    "cat_bliss":    ("fs", "263/263778_4930786",   18.99, False, None),   # Purr of a cat
    "cat_hungry":   ("mixkit", 45,                  0.00, False, None),   # Domestic cat hungry meow
    "cat_sad":      ("fs", "370/370160_5996864",    2.85, True,  None),   # Cat Crying
    "cat_sorry":    ("fs", "840/840345_18292866",   0.00, False, None),   # sound cat soft meow
    "cat_surprise": ("fs", "191/191938_3564180",    0.00, False, None),   # Cat Screams
    "cat_tired":    ("fs", "875/875658_19444464",   0.15, False, None),   # My cat waking up
    # ---------- 狗 ----------
    "dog_angry":    ("mixkit", 54,                  0.00, False, None),   # Medium size angry dog bark
    "dog_alert":    ("mixkit", 1,                   0.00, False, None),   # Dog barking twice
    "dog_confused": ("fs", "827/827669_71257",      0.00, False, None),   # Dog Groan
    "dog_cry":      ("mixkit", 468,                 0.00, False, None),   # Dog whimper really sad
    "dog_happy":    ("mixkit", 741,                 0.00, False, None),   # Happy puppy barks
    "dog_grumpy":   ("mixkit", 56,                  0.00, False, None),   # Aggressive medium sized dog growling
    "dog_bliss":    ("fs", "850/850799_14122564",   0.10, False, None),   # Dog purr
    "dog_hungry":   ("fs", "396/396045_4368151",    1.40, False, None),   # fido is hungry
    "dog_sad":      ("mixkit", 466,                 0.00, False, None),   # Dog whimper sad
    "dog_sorry":    ("fs", "350/350593_6433555",    0.00, False, None),   # Chihuahua Puppy Whine
    "dog_surprise": ("fs", "427/427133_8343580",    0.00, False, "mean16"),  # surprised little dog bark
    "dog_tired":    ("mixkit", 52,                  0.00, False, None),   # Big tired dog panting
}

TRIM = "silenceremove=start_periods=1:start_duration=0.03:start_threshold=-45dB:" \
       "stop_periods=-1:stop_duration=0.10:stop_threshold=-45dB"
FADES = "afade=t=in:st=0:d=0.012,areverse,afade=t=in:st=0:d=0.05,areverse"


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def measure_lufs(path):
    """integrated LUFS；<1s 的素材 loudnorm 会测成 -inf，调用方改用 mean_db"""
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", path, "-af",
         "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True)
    s = p.stderr
    a, b = s.rfind("{"), s.rfind("}")
    return float(json.loads(s[a:b + 1])["input_i"])


def mean_db(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect",
                        "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"mean_volume: ([-\d.]+) dB", p.stderr)
    return float(m.group(1))


def url_for(source, sid):
    if source == "mixkit":
        return f"{MIXKIT}/{sid}/{sid}-preview.mp3"
    return f"{FREESOUND}/{sid}-lq.mp3"


def base_wav(src, start, denoise, dest):
    filters = ""
    if denoise:
        filters += "highpass=f=70,lowpass=f=9000,afftdn=nr=18:nf=-45,"
    filters += f"atrim={start}:{start + 3.0},asetpts=PTS-STARTPTS,{TRIM},{FADES}"
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vn", "-ac", "1",
         "-ar", str(SR), "-af", filters, "-c:a", "pcm_s16le", dest])


def build(name, src, start, denoise, special, out):
    fd, base = tempfile.mkstemp(prefix=name + "-base-", suffix=".wav"); os.close(fd)
    fd, cur = tempfile.mkstemp(prefix=name + "-cur-", suffix=".wav"); os.close(fd)
    try:
        base_wav(src, start, denoise, base)
        gain = 0.0
        if special == "mean16":
            gain = -16.0 - mean_db(base)
            run(["ffmpeg", "-y", "-v", "error", "-i", base, "-af",
                 f"volume={gain:.2f}dB,alimiter=limit=0.84:attack=3:release=40:level=false",
                 "-c:a", "pcm_s16le", cur])
        else:
            for _ in range(5):
                need = TARGET_LUFS - measure_lufs(cur if os.path.getsize(cur) else base)
                if abs(need) < 0.15:
                    break
                gain = min(MAX_GAIN, gain + need)
                run(["ffmpeg", "-y", "-v", "error", "-i", base, "-af",
                     f"volume={gain:.2f}dB,alimiter=limit=0.84:attack=5:release=50:level=false",
                     "-c:a", "pcm_s16le", cur])
        final = cur if os.path.getsize(cur) else base
        run(["ffmpeg", "-y", "-v", "error", "-i", final, "-c:a", "libmp3lame",
             "-b:a", "64k", "-ac", "1", "-ar", str(SR), "-map_metadata", "-1", out])
        return gain
    finally:
        for p in (base, cur):
            try:
                os.unlink(p)
            except OSError:
                pass


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, (src_type, sid, start, denoise, special) in SOURCES.items():
        fd, raw = tempfile.mkstemp(prefix=name + "-", suffix=".mp3"); os.close(fd)
        try:
            req = urllib.request.Request(url_for(src_type, sid), headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r, open(raw, "wb") as f:
                f.write(r.read())
            out = os.path.join(OUT, name + ".mp3")
            gain = build(name, raw, start, denoise, special, out)
            size = os.path.getsize(out)
            total += size
            dur = subprocess.check_output([
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "csv=p=0", out]).decode().strip()
            print(f"{name:14s} {dur:>5}s  {size/1024:5.1f}KB  gain {gain:+5.2f}dB  <- {src_type}/{sid}")
        finally:
            try:
                os.unlink(raw)
            except OSError:
                pass
    print(f"\n24 files, {total/1024:.0f}KB -> {OUT}")


if __name__ == "__main__":
    raise SystemExit("Retired: use tools/extract_soundboard_from_video.py /path/to/reference.mp4")
