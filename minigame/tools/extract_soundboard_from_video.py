#!/usr/bin/env python3
"""Extract the 24 sounds from the user-provided soundboard recording.

The clip windows follow the selected-card order in the recording:
cat row-major, then dog row-major. Audio is silence-trimmed, normalized, and
written to assets/sounds/<animal>_<emotion>.mp3.

Usage: python3 tools/extract_soundboard_from_video.py /path/to/reference.mp4
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sounds")

# (animal, emotion key, start seconds, end seconds), aligned to the highlighted
# card in the video. The grid order is: angry, alert, confused, cry, happy,
# grumpy, bliss, hungry, sad, sorry, surprise, tired.
CLIPS = [
    ("cat", "angry", 1.20, 1.98),
    ("cat", "alert", 3.96, 5.34),
    ("cat", "confused", 6.60, 7.48),
    ("cat", "cry", 9.54, 10.18),
    ("cat", "happy", 15.28, 16.31),
    ("cat", "grumpy", 18.42, 19.23),
    ("cat", "bliss", 20.61, 21.70),
    ("cat", "hungry", 22.89, 25.00),
    ("cat", "sad", 26.61, 27.70),
    ("cat", "sorry", 28.99, 30.10),
    ("cat", "surprise", 31.61, 32.60),
    ("cat", "tired", 33.60, 35.00),
    # The same card is replayed several times in the recording; keep one clean
    # angry bark/growl pass rather than concatenating the repeated taps.
    ("dog", "angry", 37.42, 40.20),
    ("dog", "alert", 47.80, 49.18),
    ("dog", "confused", 50.90, 52.58),
    ("dog", "cry", 54.85, 55.80),
    ("dog", "happy", 57.58, 59.25),
    ("dog", "grumpy", 60.40, 64.48),
    ("dog", "bliss", 64.40, 68.55),
    ("dog", "hungry", 68.38, 70.96),
    ("dog", "sad", 70.95, 73.60),
    ("dog", "sorry", 73.66, 75.00),
    ("dog", "surprise", 76.11, 77.70),
    ("dog", "tired", 78.82, 83.10),
]


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        check=True, capture_output=True, text=True)
    return float(result.stdout.strip())


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    video = os.path.abspath(sys.argv[1])
    if not os.path.isfile(video):
        raise SystemExit(f"Video not found: {video}")
    os.makedirs(OUT, exist_ok=True)

    for animal, key, start, end in CLIPS:
        dest = os.path.join(OUT, f"{animal}_{key}.mp3")
        af = (
            "silenceremove=start_periods=1:start_duration=0.025:start_threshold=-43dB:"
            "stop_periods=1:stop_duration=0.75:stop_threshold=-43dB,"
            "loudnorm=I=-16:TP=-1.5:LRA=11,"
            "afade=t=in:st=0:d=0.012,areverse,afade=t=in:st=0:d=0.06,areverse"
        )
        run([
            "ffmpeg", "-y", "-ss", str(start), "-i", video, "-t", str(end - start),
            "-vn", "-ac", "1", "-ar", "44100", "-af", af,
            "-c:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1", dest,
        ])
        print(f"{animal}_{key:9s} {duration(dest):5.2f}s  {os.path.getsize(dest) / 1024:5.1f} KB")


if __name__ == "__main__":
    main()
