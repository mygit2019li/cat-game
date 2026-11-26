"""gen_mouse_scurry_sfx.py — 从老鼠命中录音里裁出「单声短吱」，作为出洞/移动音效。

背景
  命中音 mouse-squeak.wav 是实拍视频里连着的 3 声「吱吱吱」（1.05s）。
  移动循环原本复用这段录音，两个问题：
    ① 听感和命中一模一样，只是音量小，玩家分不清「老鼠在跑」和「打中了」；
    ② sfxPool 按 src 单例，命中音和循环音抢同一个音频实例，互相掐断。
  改为独立素材后，命中=3 声连叫、移动=1 声短吱，两个实例互不干扰。

做法（纯裁切，不改音色）
  取录音第 2 声（0.542–0.662s，包络最干净的一整声）：3ms 淡入 + 30ms 淡出，
  峰值归一到 -6 dBFS（比命中音低 3dB，移动是背景声不该抢命中）。
  输出 44.1kHz/16bit 单声道 wav，与源素材同规格。

运行：python3 tools/gen_mouse_scurry_sfx.py
"""
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "sfx", "mouse-squeak.wav")
OUT = os.path.join(ROOT, "assets", "sfx", "mouse-scurry.wav")

with wave.open(SRC, "rb") as w:
    sr, sw, ch, n = w.getframerate(), w.getsampwidth(), w.getnchannels(), w.getnframes()
    a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32767

# 第 2 声：0.542s 起音（0.540 还是底噪，0.550 已到 0.71），0.662s 衰减到底噪
y = a[int(0.542 * sr):int(0.662 * sr)].copy()

# 3ms 淡入 / 30ms 淡出，去掉裁切端点的咔哒声
fi, fo = int(0.003 * sr), int(0.030 * sr)
y[:fi] *= np.linspace(0, 1, fi) ** 0.6
y[-fo:] *= np.linspace(1, 0, fo) ** 1.5

y = y / (np.max(np.abs(y)) + 1e-9) * 10 ** (-6 / 20)   # 归一到 -6 dBFS

with wave.open(OUT, "wb") as w:
    w.setnchannels(ch)
    w.setsampwidth(sw)
    w.setframerate(sr)
    w.writeframes((y * 32767).astype("<i2").tobytes())

print(f"{os.path.basename(OUT)}  {len(y)/sr:.3f}s  {os.path.getsize(OUT)} bytes  peak -6dBFS")
