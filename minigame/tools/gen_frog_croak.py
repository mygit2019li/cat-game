#!/usr/bin/env python3
"""gen_frog_croak.py — 纯原创合成的蛙鸣（当前正式素材改为真实录音，本脚本作为备选保留）

正式素材：assets/sfx/*.mp3 由 tools/cut_frog_voice.py 从 tools/audio-source/10241.mp3 切出。
本脚本用于「不想用那段录音」时回退到完全自制的版本，运行会覆盖 assets/sfx 下同名文件。

为什么是合成而不是采样：可商用的真实蛙鸣录音基本是 CC BY-SA（要求署名+相同方式共享），
嵌进商业小游戏有授权风险。这里的做法是「按真实蛙鸣的声学参数合成」——
参数来自对真实录音（池塘蛙，频谱重心约 680Hz、包络调制 54-75Hz、能量峰 460-780Hz）的测量。

声学模型：
  1. 声门源：锯齿 + 方波，基频 400-500Hz（蛙鸣不是低沉的牛叫，而是偏"嗓"的中频）
  2. 声门脉冲串：55-65Hz 的快速起落（"呱"的粗糙颗粒来源；太慢会像机关枪）
  3. 共振峰：420 / 760 / 1300Hz 三组，权重递减
  4. 气流噪声 + tanh 饱和 + 1.9kHz 四阶低通（去掉"嘶"的高频）
  5. 包络：10ms 起音、尾部 42% 衰减

用法：python3 tools/gen_frog_croak.py      # 输出 assets/sfx/*.mp3
依赖：numpy scipy，系统需有 ffmpeg
（managed venv 里没装 numpy/scipy，用 /opt/anaconda3/bin/python3 运行）
"""
import numpy as np
from scipy import signal
import wave, subprocess, os, tempfile

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sfx")


def croak(dur, f0, pulse, seed, noise_amt=0.06, harsh=2.6, drop=0.10,
          formants=((420, 3.5, 1.0), (760, 4.5, 0.5), (1250, 6.0, 0.10)), lp=1200, pj=0.05):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.arange(n) / SR
    k = t / dur
    # 音高轮廓：起音略上挑、尾部下滑
    f = f0 * (1 + 0.05 * np.exp(-k * 10) - drop * k) * (1 + 0.012 * np.sin(2 * np.pi * 7 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    src = 0.65 * signal.sawtooth(ph) + 0.35 * np.sign(np.sin(ph))
    # 声门脉冲串（带轻微抖动：真实蛙鸣不是节拍器）
    inst = pulse * (1 + pj * np.sin(2 * np.pi * 4.7 * t + seed) + pj * 0.6 * np.sin(2 * np.pi * 11.3 * t))
    pph = (np.cumsum(inst) / SR) % 1.0
    gate = (1 - np.exp(-pph / 0.04)) * np.exp(-pph / 0.30)
    src *= 0.05 + 0.95 * gate
    # 共振峰
    out = np.zeros_like(src)
    for fc, q, w in formants:
        b, a = signal.iirpeak(fc / (SR / 2), q)
        out += signal.lfilter(b, a, src) * w
    # 气流噪声
    nz = rng.normal(0, 1, n)
    bb, aa = signal.butter(2, [300 / (SR / 2), 1200 / (SR / 2)], btype="band")
    out += signal.lfilter(bb, aa, nz) * noise_amt
    # 包络
    a2 = int(0.010 * SR)
    r2 = int(dur * 0.42 * SR)
    env = np.ones(n)
    env[:a2] = np.linspace(0, 1, a2) ** 0.6
    env[-r2:] = np.linspace(1, 0, r2) ** 1.5
    out *= env
    out = np.tanh(out * harsh) * 0.8
    out = signal.lfilter(*signal.butter(4, lp / (SR / 2)), out)
    out = signal.lfilter(*signal.butter(2, 250 / (SR / 2), btype="high"), out)
    return out / (np.max(np.abs(out)) + 1e-9) * 0.85


def write_mp3(name, x):
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, name + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    mp3 = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                    "-ac", "1", "-ar", "32000", "-b:a", "64k", mp3], check=True)
    print(f"{name}.mp3  {len(x)/SR:.2f}s  {os.path.getsize(mp3)} bytes")
    return mp3


def main():
    os.makedirs(OUT, exist_ok=True)
    # 静坐偶发：两段单声，音高略有差别（听起来像两只青蛙）
    a = croak(0.26, 452, 63, seed=21)
    b = croak(0.31, 398, 58, seed=33, noise_amt=0.07, drop=0.13)
    # 落地：一声「呱呱」（两声之间 90ms 静音，第二声略低），时长 0.6s 左右
    gap = np.zeros(int(0.09 * SR))
    d1 = croak(0.24, 462, 63, seed=41, drop=0.07)
    d2 = croak(0.29, 408, 58, seed=47, noise_amt=0.07, drop=0.14)
    dbl = np.concatenate([d1, gap, d2])
    write_mp3("frog-croak-1", a)
    write_mp3("frog-croak-2", b)
    write_mp3("frog-land", dbl)


if __name__ == "__main__":
    main()
