"""gen_rabbit_hit_sfx.py — 生成兔子被拍中的「星爆」音效（原创合成）

参考视频里兔子被拍中时是一簇 0.2–0.5s 的明亮碎响，比跳步轻响更响、更“炸”。
这里用三层合成：
  1. 低频 pop：160→55Hz 下滑 + 短促 click，给“被拍中”的重量；
  2. 高频 shimmer：2.5–6kHz 窄带噪声 + 4 个错开的铃音（1.8/2.4/3.2/4.2kHz），给星爆的亮片感；
  3. 一声很短的“吱”：900→1500Hz，玩具被拍中的拟声。
产物：assets/sfx/rabbit-hit.wav（44.1kHz 16bit 单声道，约 0.45s）
运行：python3 tools/gen_rabbit_hit_sfx.py
"""
import os
import wave

import numpy as np
from scipy import signal

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sfx")
DUR = 0.45


def main():
    n = int(DUR * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    y = np.zeros(n)

    # 1) 低频 pop：160→55Hz，0.20s 衰减
    f0, f1 = 160.0, 55.0
    f = f0 * (f1 / f0) ** (t / 0.22)
    phase = 2 * np.pi * np.cumsum(f) / SR
    y += 0.62 * np.sin(phase) * np.exp(-t / 0.16)

    # 2) 起音 click：4ms 高通噪声
    nz = rng.normal(0, 1, n)
    b, a = signal.butter(3, 1800 / (SR / 2), btype="high")
    y += 0.30 * signal.lfilter(b, a, nz) * np.exp(-t / 0.006)

    # 3) 高频 shimmer：2.5–6kHz 窄带噪声，0.28s 衰减
    b2, a2 = signal.butter(3, [2500 / (SR / 2), 6000 / (SR / 2)], btype="band")
    y += 0.16 * signal.lfilter(b2, a2, nz) * np.exp(-t / 0.22)

    # 4) 四个错开的铃音，给星爆的“亮片”层次
    for i, (freq, delay, amp, dec) in enumerate([
        (1800, 0.012, 0.18, 0.20),
        (2400, 0.040, 0.15, 0.17),
        (3200, 0.070, 0.12, 0.14),
        (4200, 0.100, 0.09, 0.12),
    ]):
        st = int(delay * SR)
        seg = np.zeros(n)
        tt = np.arange(n - st) / SR
        seg[st:] = amp * np.sin(2 * np.pi * freq * tt + i) * np.exp(-tt / dec)
        y += seg

    # 5) 短“吱”：900→1500Hz，0.09s
    st = int(0.025 * SR)
    tt = np.arange(n - st) / SR
    fq = 900 * (1500 / 900) ** (tt / 0.09)
    ph = 2 * np.pi * np.cumsum(fq) / SR
    squeak = 0.14 * np.sin(ph) * np.exp(-tt / 0.055)
    squeak[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    y[st:] += squeak

    # 6) 尾淡出 + 归一化到 -1.5dBFS
    fade = int(0.06 * SR)
    y[-fade:] *= np.linspace(1, 0, fade) ** 1.5
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.84

    path = os.path.join(OUT, "rabbit-hit.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())
    print(f"rabbit-hit.wav  {DUR:.2f}s  {os.path.getsize(path)} bytes  peak {np.max(np.abs(y)):.2f}")


if __name__ == "__main__":
    main()
