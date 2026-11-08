"""extract_rabbit_sfx.py — 从参考视频里提取兔子的真实音效

用法：
  python3 tools/extract_rabbit_sfx.py "/path/to/rabbit.mp4"

产物（assets/sfx/）：
  rabbit-hop.wav          精确截取的“跳一下”音效（游戏里每次起跳播放一次）
  rabbit-video-1/2/3.wav  视频里检测到的前三记瞬态（方便对比/替换）

做法：
  1. ffmpeg 解码成单声道 44.1kHz，高通 220Hz + 低通 12kHz，去掉房间低频轰鸣；
  2. 5ms RMS 包络找瞬态峰值，合并 0.12s 内的重复峰；
  3. 每段只截 15ms 前 + 110ms 后，且不越过下一记瞬态；按包络衰减自动收短，
     8ms 淡入淡出，归一化到 -5dBFS；
  4. 第一记（兔子开始跳的那一下）写成 rabbit-hop.wav。
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sfx")
SR = 44100


def decode(video):
    fd, wav_path = tempfile.mkstemp(prefix="rabbit-", suffix=".wav")
    os.close(fd)
    cmd = [
        "ffmpeg", "-y", "-v", "error", "-i", video,
        "-vn", "-ac", "1", "-ar", str(SR),
        "-af", "highpass=f=300,lowpass=f=10000",
        "-c:a", "pcm_s16le", wav_path,
    ]
    subprocess.run(cmd, check=True)
    with wave.open(wav_path, "rb") as w:
        n = w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    os.unlink(wav_path)
    return x


def envelope(x, win=0.005):
    hop = max(1, int(SR * win))
    n = len(x) // hop
    env = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    times = np.arange(n) * win
    return times, env


def find_events(times, env, min_gap=0.12, rel=0.38):
    thr = max(0.004, float(env.max()) * rel)
    peaks = []
    for i in range(1, len(env) - 1):
        if env[i] >= env[i - 1] and env[i] >= env[i + 1] and env[i] > thr:
            peaks.append(i)
    peaks.sort(key=lambda i: env[i], reverse=True)
    picked = []
    for i in peaks:
        if all(abs(times[i] - times[j]) >= min_gap for j in picked):
            picked.append(i)
        if len(picked) >= 3:
            break
    picked.sort(key=lambda i: times[i])
    return [times[i] for i in picked]


def clip(x, center, next_at=None, pre=0.015, post=0.11):
    a = max(0, int((center - pre) * SR))
    b = min(len(x), int((center + post) * SR))
    if next_at is not None:
        b = min(b, int((next_at - 0.012) * SR))     # 绝不把下一记声音一起截进来
    y = x[a:b].copy()
    n = len(y)
    if n < 32:
        return None
    # 按包络衰减自动收短：只保留到最后一个 >8% 峰值的采样，再留 10ms 尾巴
    peak = float(np.max(np.abs(y))) or 1.0
    idx = np.where(np.abs(y) > peak * 0.08)[0]
    if len(idx):
        last = min(n, int(idx[-1] + 0.010 * SR))
        y = y[:last]
        n = len(y)
    if n < 32:
        return None
    fade = max(1, int(0.008 * SR))
    y[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
    y[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    peak = float(np.max(np.abs(y))) or 1.0
    return y / peak * 0.56


def write(name, y):
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    print(f"{name}  {len(y)/SR:.3f}s  {os.path.getsize(path)} bytes")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    video = os.path.abspath(sys.argv[1])
    if not os.path.exists(video):
        print("not found:", video)
        sys.exit(2)
    os.makedirs(OUT, exist_ok=True)
    x = decode(video)
    times, env = envelope(x)
    events = find_events(times, env)
    print("duration", round(len(x) / SR, 3), "s; events:", [round(t, 3) for t in events])
    clips = []
    for i, t in enumerate(events):
        nxt = events[i + 1] if i + 1 < len(events) else None
        y = clip(x, t, next_at=nxt)
        if y is not None:
            clips.append((t, y))
            write(f"rabbit-video-{i+1}.wav", y)
    if not clips:
        print("no transient found")
        sys.exit(1)
    # 兔子开始移动的那一下（第一记）作为“跳一下”的音效
    write("rabbit-hop.wav", clips[0][1])
    print("selected first event", round(clips[0][0], 3), "s -> assets/sfx/rabbit-hop.wav")


if __name__ == "__main__":
    main()
