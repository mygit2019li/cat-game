#!/usr/bin/env python3
"""cut_frog_voice.py — 从真实蛙鸣录音里切出游戏用的三段"呱"

音源：tools/audio-source/10241.mp3（用户提供的真实蛙叫，6.1s，含 4 声"呱呱"）
产物：assets/sfx/frog-croak-1.wav / frog-croak-2.wav / frog-land.wav / frog-hit.wav

为什么是 wav 而不是 mp3：微信开发者工具在上传/编译 mp3 时会先转出一份同名 .wav 再读，
这一步在某些版本上会失败并报 `ENOENT ... frog-croak-2.wav`。直接给 wav 就没有这层转换了；
短音效本来也不需要 mp3 压缩（4 段合计约 60KB）。

处理：自动检测有声段 → 每个"呱"取 pre-roll 40ms + 尾部 70ms → 6ms 淡入 / 25ms 淡出
→ 峰值归一化到 0.55（原录音有削波，必须降增益）→ 单声道 22.05kHz / 16bit。

为什么归一化到 0.55：原文件峰值已经贴到 1.0（削波），MP3 编码还会有 2-3dB 振铃过冲
（实测 0.72 归一化解码后冲到 0.97），所以留足余量，游戏里再用 volume 调实际响度。

用法：python3 tools/cut_frog_voice.py
依赖：numpy scipy ffmpeg
"""
import numpy as np
import wave
import subprocess
import os
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "audio-source", "10241.mp3")
OUT = os.path.join(ROOT, "assets", "sfx")
SR = 44100

PRE = 0.040      # 起音前留白，避免掐头
TAIL = 0.070     # 尾巴，保住"呱"的余韵
PEAK = 0.55


def decode(path):
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, "src.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path,
                    "-ac", "1", "-ar", str(SR), wav], check=True)
    with wave.open(wav) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768


def find_croaks(x):
    hop = int(0.01 * SR)
    n = len(x) // hop
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    on = rms > max(rms.max() * 0.12, 0.005)
    segs, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            segs.append((i * hop, j * hop))
            i = j
        else:
            i += 1
    # 相邻爆发合并成一个"呱"（真实蛙叫常是「呱-呱」两下，间隔 <250ms）
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < int(0.25 * SR):
            merged[-1] = (merged[-1][0], s[1])
        else:
            merged.append(list(s))
    return [tuple(m) for m in merged if m[1] - m[0] > int(0.05 * SR)]


def cut(x, a, b):
    lo = max(0, int(a - PRE * SR))
    hi = min(len(x), int(b + TAIL * SR))
    y = x[lo:hi].copy()
    # 淡入淡出（去咔哒）
    fi, fo = int(0.006 * SR), int(0.025 * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo) ** 1.4
    y = y / (np.max(np.abs(y)) + 1e-9) * PEAK
    return y


def write(name, y):
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, name + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    # 同时出一份 mp3：代码只引用 wav（避开开发者工具处理 mp3 时读同名 .wav 的坑），
    # 但 mp3 同留在目录里，是因为工具的文件索引可能还记着这两个名字——文件都在，才不会 ENOENT。
    # 等确认上传稳定、并清过工具缓存后，可以删掉 mp3 这一段。
    mp3 = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                    "-ac", "1", "-ar", "44100", "-b:a", "64k",
                    "-map_metadata", "-1", "-write_id3v1", "0", "-id3v2_version", "0",
                    mp3], check=True)

    out = os.path.join(OUT, name + ".wav")
    # 22.05kHz / 16bit / 单声道：蛙鸣能量都在 2kHz 以下，这个采样率完全够，
    # 一段 0.3 秒只有 13KB 左右，比 mp3 大不了多少，但省掉工具侧的转码。
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                    "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le",
                    "-map_metadata", "-1", out], check=True)
    print(f"{name}.wav  {len(y) / SR:.2f}s  峰值 {np.max(np.abs(y)):.2f}  "
          f"RMS {np.sqrt(np.mean(y ** 2)):.3f}  {os.path.getsize(out)} bytes")


def main():
    x = decode(SRC)
    croaks = find_croaks(x)
    print("检出", len(croaks), "声呱：", [(round(a / SR, 2), round(b / SR, 2)) for a, b in croaks])
    if len(croaks) < 3:
        raise SystemExit("录音里不足 3 声呱，检查音源")
    os.makedirs(OUT, exist_ok=True)
    # 第 1/3 声给静坐偶发（有差别，像两只青蛙），第 2 声给落地"呱呱"，第 4 声给"拍中时的惊叫"
    write("frog-croak-1", cut(x, *croaks[0]))
    write("frog-croak-2", cut(x, *croaks[2]))
    write("frog-land", cut(x, *croaks[1]))
    write("frog-hit", cut(x, *croaks[3]))


if __name__ == "__main__":
    main()
