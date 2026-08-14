#!/usr/bin/env python3
"""
frame-shot.py — 제품 캡처에 **브라우저 창 액자**를 씌웁니다 〔신설 2026-08-14 · basis-split-s13〕.

왜 있는가
---------
랜딩 04 상품소개는 탭 3개가 **같은 자리에서 그림만 바꿉니다**. 그래서 세 캡처의 액자가
다르면, 탭을 누를 때마다 창틀이 나타났다 사라집니다 — 상품이 셋이 아니라 화면이 셋으로
보입니다. `c03-result.jpg` 는 처음부터 macOS 창틀을 물고 찍혔고, `timeline-map.jpg` 는
패널만 잘라 찍혔습니다. 그 둘을 맞추려면 창틀을 **그릴 수 있어야** 합니다.

치수는 상상이 아니라 `img/c03-result.jpg` 실측입니다(폭 1383 기준 · 아래 REF_* 참조).
새 캡처를 넣을 때 이 스크립트를 쓰면 액자가 저절로 같아집니다.

    python3 scripts/frame-shot.py <입력.png> <출력.jpg> --url "app.trops.kr/..." \
        [--pad 28] [--bg "#F8FAFC"] [--quality 82]

⚠️ `img/c03-result.jpg` 에는 다시 씌우지 마십시오 — 그 파일이 **치수의 정본**이고,
   이미 창틀을 갖고 있습니다. 두 번 씌우면 창틀 안에 창틀이 생깁니다.
⚠️ 파이썬 스크립트는 이 저장소에서 이 파일 하나뿐입니다(빌드·런타임과 무관한 자산 도구).
   `npm test` / `npm run build` 어느 쪽도 이 파일을 부르지 않습니다.
"""

import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

# ── c03-result.jpg 실측값 (폭 1383 기준) ──────────────────────────────────────
REF_W = 1383
REF_BAR_H = 57          # 창틀 높이(맨 아래 1px 구획선 포함)
REF_DOT_D = 14          # 신호등 지름
REF_DOT_Y = 28          # 신호등 중심 y
REF_DOT_X = (26, 48, 70)
REF_PILL = (98, 13, 41, 43)   # left, top, right-margin, bottom
REF_LOCK_X = 107
REF_TEXT_X = 130
REF_FONT = 14

BAR = (225, 232, 240)         # #E1E8F0
BAR_LINE = (207, 210, 215)    # 창틀 아래 구획선
PILL_LINE = (207, 210, 217)
DOTS = ((255, 92, 85), (249, 194, 52), (48, 205, 72))
TEXT = (54, 53, 58)

MONO = "/System/Library/Fonts/Menlo.ttc"


def load_font(size):
    """Menlo 가 없으면 기본 폰트로 떨어집니다 — 액자는 그려지고 글자만 달라집니다."""
    try:
        return ImageFont.truetype(MONO, size)
    except OSError:
        return ImageFont.load_default()


def draw_lock(d, x, y, h, color):
    """자물쇠 — 아이콘 폰트를 끌어오지 않으려고 선 두 개로 그립니다."""
    body_h = int(h * 0.55)
    top = y + h - body_h
    d.rounded_rectangle([x, top, x + h * 0.78, y + h], radius=2, outline=color, width=1)
    r = h * 0.28
    cx = x + h * 0.39
    d.arc([cx - r, top - r * 1.15, cx + r, top + r * 0.85], start=180, end=360,
          fill=color, width=1)


def frame(src_path, out_path, url, pad, bg, quality):
    img = Image.open(src_path).convert("RGB")
    body_w = img.size[0] + pad * 2
    s = body_w / REF_W

    bar_h = round(REF_BAR_H * s)
    canvas = Image.new("RGB", (body_w, bar_h + img.size[1] + pad), bg)
    canvas.paste(img, (pad, bar_h))

    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, body_w, bar_h - 1], fill=BAR)
    d.line([(0, bar_h - 1), (body_w, bar_h - 1)], fill=BAR_LINE)

    dot_r = REF_DOT_D * s / 2
    for cx, color in zip(REF_DOT_X, DOTS):
        x, y = cx * s, REF_DOT_Y * s
        d.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=color)

    left, top, right_margin, bottom = REF_PILL
    px0, py0 = left * s, top * s
    px1, py1 = body_w - right_margin * s, bottom * s
    d.rounded_rectangle([px0, py0, px1, py1], radius=(py1 - py0) / 2,
                        fill=(255, 255, 255), outline=PILL_LINE, width=1)

    lock_h = round(13 * s)
    draw_lock(d, REF_LOCK_X * s, (py0 + py1) / 2 - lock_h / 2, lock_h, (120, 124, 130))

    font = load_font(round(REF_FONT * s))
    tx = REF_TEXT_X * s
    avail = px1 - tx - 12 * s
    text = url
    while d.textlength(text, font=font) > avail and len(text) > 8:
        text = text[:-2] + "…"
    d.text((tx, (py0 + py1) / 2), text, font=font, fill=TEXT, anchor="lm")

    canvas.save(out_path, quality=quality, optimize=True, progressive=True)
    return canvas.size, os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--url", required=True)
    ap.add_argument("--pad", type=int, default=28,
                    help="캡처 좌우·아래에 덧대는 페이지 여백(px)")
    ap.add_argument("--bg", default="#F8FAFC", help="그 여백의 색 — 제품 페이지 배경")
    ap.add_argument("--quality", type=int, default=82)
    args = ap.parse_args()

    bg = tuple(int(args.bg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    size, nbytes = frame(args.src, args.out, args.url, args.pad, bg, args.quality)
    print(f"{args.out}  {size[0]}x{size[1]}  {nbytes // 1024}KB")


if __name__ == "__main__":
    sys.exit(main())
