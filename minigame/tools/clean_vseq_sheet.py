#!/usr/bin/env python3
"""vseq 基准灰鼠 sheet 离线去噪（一次性素材修复，几何/alpha 不变）。

斑块来源（已实测）：
  1) 视频自身柔光阴影 → 鼠身 ±10~15 级低频明暗偏离（亮斑占 body 6~14%）
  2) H.264 压缩块 → 4~8px 马赛克
  LUT 重着色按"亮度→颜色"忠实映射（斜率 1.0~1.27），把亮度差转成色差，
  look/sit 段下采样比仅 0.44×，屏上块更大 → peek 态斑块最明显。

处理（逐帧格）：
  1) 低频压平：31px 高斯残差（相对 51px 慢基线）×0.85 压掉柔光斑
  2) 平涂区清马赛克：低梯度区 9×9 模糊（羽化 mask 防接缝）
  3) 细节保护：|L - 帧内鼠身中位数| >= 50 的像素（眼睛/胡须/内耳线）原样保留
只改鼠身内部 RGB（erode 9×9 后的 body mask），轮廓线与 alpha 完全不动，
因此 VSEQ_META.mouseW 校准与裁剪窗均不受影响。

用法：
  python clean_vseq_sheet.py            # 处理 fast/look/sit 三张（自动备份 *_sheet_orig.png）
  python clean_vseq_sheet.py --dry      # 只算统计不写文件
  python clean_vseq_sheet.py look       # 只处理指定段
"""
import re
import sys
import shutil
import numpy as np
import cv2
from PIL import Image

BASE = "/Users/lipeng/www/myproject/cat-game/minigame"
DRAW_JS = f"{BASE}/js/draw.js"
ASSETS = f"{BASE}/assets/mice/video"


def parse_meta():
    """从 draw.js 解析 VSEQ_META（frames/cellW/file），避免手写漂移。"""
    src = open(DRAW_JS, encoding="utf-8").read()
    m = re.search(r"const VSEQ_META = \{(.*?)\n  \};", src, re.S)
    meta = {}
    for line in m.group(1).splitlines():
        mm = re.match(r"\s*(fast|look|sit)\s*:\s*\{(.*)\}", line)
        if not mm:
            continue
        seg, body = mm.group(1), mm.group(2)
        get = lambda k: float(re.search(k + r":\s*([\d.]+)", body).group(1))
        meta[seg] = dict(
            frames=int(get("frames")),
            cellW=get("cellW"),
            file=re.search(r'file:\s*"([^"]+)"', body).group(1),
        )
    return meta


def clean_cell(cellL, cellA):
    """单帧格去噪。cellL: 亮度 float32, cellA: alpha uint8。"""
    body = cv2.erode((cellA > 128).astype(np.uint8) * 255, np.ones((9, 9), np.uint8)) > 0
    if body.sum() < 200:
        return cellL
    out = cellL.copy()
    Lmed = float(np.median(cellL[body]))
    # 1) 低频光斑压平
    low = cv2.GaussianBlur(cellL, (31, 31), 0)
    resid_low = low - cv2.GaussianBlur(low, (51, 51), 0)
    flat = out - 0.85 * resid_low
    # 2) 平涂区马赛克（低梯度区模糊，羽化防接缝）
    lap = np.abs(cv2.Laplacian(flat, cv2.CV_32F))
    flatmask = cv2.GaussianBlur((lap < 5).astype(np.float32), (7, 7), 0)
    blur = cv2.GaussianBlur(flat, (9, 9), 2.2)
    flat2 = flat * (1 - flatmask) + blur * flatmask
    # 3) 高对比细节保护
    detail = np.abs(flat - Lmed) >= 50
    detmask = cv2.GaussianBlur(detail.astype(np.float32), (3, 3), 0.8)
    res = flat2 * (1 - detmask) + out * detmask
    return np.where(body, np.clip(res, 0, 255), cellL)


def stats(sheetL, sheetA, meta):
    """处理前后对比统计：body 内低频残差 std / 亮斑% / 暗斑%。"""
    stds, bps, dps = [], [], []
    for f in range(meta["frames"]):
        x0 = int(round(f * meta["cellW"]))
        x1 = min(sheetL.shape[1], int(round((f + 1) * meta["cellW"])))
        cellL, cellA = sheetL[:, x0:x1], sheetA[:, x0:x1]
        body = cv2.erode((cellA > 128).astype(np.uint8) * 255, np.ones((9, 9), np.uint8)) > 0
        if body.sum() < 200:
            continue
        low = cv2.GaussianBlur(cellL, (31, 31), 0)
        resid = low - cv2.GaussianBlur(low, (51, 51), 0)
        m = body & (low > 40)
        stds.append(float(resid[m].std()))
        bps.append(float((resid[m] > 10).mean() * 100))
        dps.append(float((resid[m] < -10).mean() * 100))
    return float(np.mean(stds)), float(np.mean(bps)), float(np.mean(dps))


def process(seg, meta, dry=False):
    path = f"{ASSETS}/{meta['file']}"
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.float32)
    L = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]).astype(np.float32)

    before = stats(L, alpha, meta)

    newL = np.zeros_like(L)
    for f in range(meta["frames"]):
        x0 = int(round(f * meta["cellW"]))
        x1 = min(arr.shape[1], int(round((f + 1) * meta["cellW"])))
        newL[:, x0:x1] = clean_cell(L[:, x0:x1], alpha[:, x0:x1])
    after = stats(newL, alpha, meta)

    print(f"[{seg}] {meta['file']}  {im.size}")
    print(f"      低频std {before[0]:.2f}→{after[0]:.2f}   "
          f"亮斑 {before[1]:.1f}%→{after[1]:.1f}%   暗斑 {before[2]:.1f}%→{after[2]:.1f}%")

    if dry:
        print("      --dry：不写文件")
        return
    backup = f"{ASSETS}/{meta['file'].replace('_sheet.png', '_sheet_orig.png')}"
    if not __import__("os").path.exists(backup):
        shutil.copy2(path, backup)
        print(f"      备份原图 → {meta['file'].replace('_sheet.png', '_sheet_orig.png')}")
    newrgb = np.stack([newL] * 3, axis=-1).clip(0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([newrgb, alpha]), "RGBA").save(path)
    print("      已写回")


def main():
    meta = parse_meta()
    dry = "--dry" in sys.argv
    segs = [a for a in sys.argv[1:] if a in meta] or ["fast", "look", "sit"]
    for seg in segs:
        process(seg, meta[seg], dry)


if __name__ == "__main__":
    main()
