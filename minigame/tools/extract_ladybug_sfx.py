"""extract_ladybug_sfx.py — 从参考视频里提取瓢虫“出现”的音效

用法：
  python3 tools/extract_ladybug_sfx.py "/path/to/ladybug.mp4" [--at 0.33] [--dur 0.30]

背景：这段视频里瓢虫在约 0.33s 从平板右侧出现；音轨没有特别突出的单次瞬态，
      所以按“出现时刻”截一小段，做 300Hz 高通 + 10kHz 低通 + afftdn 轻降噪，
      归一化后作为瓢虫出现音。若你指定别的出现时刻，用 --at 覆盖。

产物：assets/sfx/ladybug-appear.wav
"""
import argparse
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sfx")
SR = 44100


def decode(video, tmp):
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-i", video,
        "-vn", "-ac", "1", "-ar", str(SR),
        "-af", "highpass=f=300,lowpass=f=10000,afftdn=nr=12:nf=-35",
        "-c:a", "pcm_s16le", tmp,
    ]
    subprocess.run(cmd, check=True)
    with wave.open(tmp, "rb") as w:
        n = w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    os.unlink(tmp)
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--at", type=float, default=0.33, help="瓢虫出现时刻（秒）")
    ap.add_argument("--dur", type=float, default=0.30, help="截取长度（秒）")
    args = ap.parse_args()
    video = os.path.abspath(args.video)
    if not os.path.exists(video):
        print("not found:", video)
        sys.exit(2)
    os.makedirs(OUT, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="ladybug-", suffix=".wav")
    os.close(fd)
    x = decode(video, tmp)
    a = max(0, int(args.at * SR))
    b = min(len(x), int((args.at + args.dur) * SR))
    y = x[a:b].copy()
    if len(y) < 32:
        print("segment too short")
        sys.exit(1)
    fade = max(1, int(0.010 * SR))
    y[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
    y[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    peak = float(np.max(np.abs(y))) or 1.0
    y = y / peak * 0.56
    path = os.path.join(OUT, "ladybug-appear.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    print(f"ladybug-appear.wav  {len(y)/SR:.3f}s  {os.path.getsize(path)} bytes  @ {args.at:.3f}s")


if __name__ == "__main__":
    main()
