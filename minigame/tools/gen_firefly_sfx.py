"""gen_firefly_sfx.py — 生成「暗夜萤光」音效（原创合成，无版权问题）

参数不是凭感觉定的，是从参考视频的音轨里量出来的（23.8s，逐 20ms 帧做 onset + 频谱重心）：
  · 拍中那一下的实测分布：重心 0.72–1.79kHz、峰值降到 10% 用时 40–190ms
    → 所以是"高频短促的玻璃质感 click + 一点点暖音尾巴"，不是低沉的水泡声
  · 三种发光动物各占一段实测区间（壳越硬越脆、身子越重越闷）：
       瓢虫 1.75kHz / 50ms（最脆，配一小段翅膜嗡）
       老鼠 1.30kHz / 80ms（中间，加一记 2.6kHz 的短促吱）
       小狗 1.00kHz / 150ms（最闷，底下垫一层 180→130Hz 的"汪"）
  · 张翅（鞘翅张开闪一下）：视频里是极轻的高频摩擦声，几乎被环境音盖住
    → 做成 1.8–3.6kHz 的窄带噪声 + 40Hz 颤音，音量压得很低

产物（22.05kHz 16bit 单声道 wav）：
  firefly-hit.wav             拍中通用（物种文件缺失时的回退）
  firefly-hit-dog.wav         拍中小狗
  firefly-hit-mouse.wav       拍中老鼠
  firefly-hit-ladybug.wav     拍中瓢虫
  firefly-flare.wav           张翅：极轻高频摩擦
  firefly-spawn.wav           出现/重生：细碎噼啪（视频 1.9–3.3s / 4.6–4.9s 里那一串 ~1kHz 小 ticks）
  firefly-shift.wav           换关：0.8s 柔和高亮 shimmer（配满屏金色火花）
运行：python3 tools/gen_firefly_sfx.py
"""
import os
import wave

import numpy as np
from scipy import signal

SR = 22050
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sfx")


def write(name, x, peak=0.55):
    y = np.clip(x, -1, 1)
    y = y / (np.max(np.abs(y)) + 1e-9) * peak
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())
    print(f"{name}.wav  {len(x)/SR:.3f}s  {os.path.getsize(path)} bytes")
    return y


def env_adsr(n, atk, rel):
    e = np.ones(n)
    a = max(1, int(atk * SR))
    r = max(1, int(rel * SR))
    e[:a] = np.linspace(0, 1, a) ** 0.6
    e[-r:] = np.linspace(1, 0, r) ** 2.0
    return e


def hit(f_cen=1040, dec=0.022, name="firefly-hit", woof=None, squeak=None, wing=False):
    """拍中：玻璃 click + 暖音尾 + 低频"啪"；三种动物在同一实测区间内各取一段

    f_cen / dec = 主体叮音的中心频率与衰减时间（对应视频量到的重心与到 10% 的时长）
    woof        = 低频"汪"的下滑频对（小狗）
    squeak      = 高频短吱的频率（老鼠）
    wing        = 是否叠一段极短的翅膜嗡（瓢虫）
    """
    dur = 0.19
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(11)

    # 1) 主体：f_cen 附近的短促"叮"
    body = np.sin(2 * np.pi * f_cen * t) * np.exp(-t / dec)
    body += 0.35 * np.sin(2 * np.pi * f_cen * 1.5) * np.exp(-t / (dec * 0.75))

    # 2) 起音噪声 click：高通噪声 4ms，给出"啪"的瞬态
    nz = rng.normal(0, 1, n)
    b, a = signal.butter(3, 1700 / (SR / 2), btype="high")
    click = signal.lfilter(b, a, nz) * np.exp(-t / 0.004) * 0.55

    # 3) 暖音尾：主体上方两个小铃，90ms
    tail = (0.12 * np.sin(2 * np.pi * f_cen * 1.9 * t) + 0.18 * np.sin(2 * np.pi * f_cen * 1.46 * t)) * np.exp(-t / 0.090)

    # 4) 极轻的低频"落点"（85Hz，60ms）：让声音有重量，不飘
    thud = np.sin(2 * np.pi * 86 * t) * np.exp(-t / 0.060) * 0.22

    x = body + click + tail + thud
    if woof:
        f0, f1 = woof
        sweep = f0 + (f1 - f0) * np.clip(t / 0.09, 0, 1)
        x += 0.34 * np.sin(2 * np.pi * np.cumsum(sweep) / SR) * np.exp(-t / 0.075)
    if squeak:
        sq = np.sin(2 * np.pi * squeak * t) * np.exp(-((t - 0.012) / 0.030) ** 2)
        x += 0.30 * sq * (t > 0.006)
    if wing:
        bw, aw = signal.butter(2, [2600 / (SR / 2), 5200 / (SR / 2)], btype="band")
        x += 0.30 * signal.lfilter(bw, aw, rng.normal(0, 1, n)) * np.exp(-t / 0.030)
    x *= env_adsr(n, 0.002, 0.05)
    x = np.tanh(x * 1.2) * 0.9
    # 去掉刺耳超高频
    b2, a2 = signal.butter(3, 6000 / (SR / 2))
    return write(name, signal.lfilter(b2, a2, x), peak=0.55)


def flare():
    """张翅：极轻的高频摩擦（鞘翅弹开的"沙"一下），带 40Hz 颤音"""
    dur = 0.16
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(23)
    nz = rng.normal(0, 1, n)
    b, a = signal.butter(2, [1600 / (SR / 2), 3600 / (SR / 2)], btype="band")
    x = signal.lfilter(b, a, nz)
    x *= 0.65 + 0.35 * np.sin(2 * np.pi * 42 * t)     # 翅膜的颤动
    x *= env_adsr(n, 0.012, 0.07)
    return write("firefly-flare", x, peak=0.26)


def spawn():
    """猎物出现/重生：视频里是一串 6–9 个极轻的 ~1kHz 小 ticks（像火星噼啪）"""
    dur = 0.42
    n = int(dur * SR)
    x = np.zeros(n)
    rng = np.random.default_rng(31)
    t0 = 0.0
    for i in range(8):
        t0 += rng.uniform(0.025, 0.062)
        if t0 > dur - 0.04: break
        k = int(t0 * SR)
        f = rng.uniform(950, 1600)
        seg_n = int(0.026 * SR)
        tt = np.arange(seg_n) / SR
        tick = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.007)
        tick += rng.normal(0, 1, seg_n) * np.exp(-tt / 0.0025) * 0.25
        end = min(n, k + seg_n)
        x[k:end] += tick[:end - k] * rng.uniform(0.35, 0.85)
    b, a = signal.butter(2, [700 / (SR / 2), 4200 / (SR / 2)], btype="band")
    x = signal.lfilter(b, a, x)
    return write("firefly-spawn", x, peak=0.30)


def shift():
    """换关：0.8s 的柔和高亮 shimmer（噪声扫频 + 两颗亮铃音），配合满屏金色火花"""
    dur = 0.85
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(47)
    nz = rng.normal(0, 1, n)
    b, a = signal.butter(2, [1800 / (SR / 2), 5200 / (SR / 2)], btype="band")
    sh = signal.lfilter(b, a, nz)
    # 缓慢起伏 + 两端淡入淡出
    sh *= (0.5 + 0.5 * np.sin(2 * np.pi * 2.3 * t)) * np.sin(np.pi * t / dur) ** 1.2
    # 两颗亮铃（高频、短）
    bell = (np.sin(2 * np.pi * 2090 * t) * np.exp(-((t - 0.10) / 0.10) ** 2) * 0.30
            + np.sin(2 * np.pi * 2790 * t) * np.exp(-((t - 0.26) / 0.12) ** 2) * 0.22)
    x = sh * 1.1 + bell
    return write("firefly-shift", x, peak=0.36)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    h = hit()
    hd = hit(1000, 0.030, "firefly-hit-dog", woof=(180, 130))
    hm = hit(1300, 0.026, "firefly-hit-mouse", squeak=2600)
    hl = hit(1750, 0.018, "firefly-hit-ladybug", wing=True)
    f = flare()
    sp = spawn()
    sh = shift()
    # 自检：中心频率要落回视频量到的 0.72–1.79kHz 区间
    for name, y in (("firefly-hit", h), ("firefly-hit-dog", hd), ("firefly-hit-mouse", hm),
                    ("firefly-hit-ladybug", hl), ("firefly-flare", f), ("firefly-spawn", sp),
                    ("firefly-shift", sh)):
        F, S = signal.welch(y, SR, nperseg=1024)
        cen = np.sum(F * S) / np.sum(S)
        print(f"  {name}: 频谱重心 {cen:.0f}Hz")
