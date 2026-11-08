#!/usr/bin/env python3
"""AI, PLEASE — pixel icon generator.

Draws at a 256x256 logical pixel grid, upscales x4 (NEAREST) to 1024x1024,
then adds CRT glow / scanlines.  Palette is copied from src/styles/global.css.

Usage:  python3 docs/brand/make-icon.py
Output: docs/brand/*.png + ai-please-icon.ico
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

# ---------------------------------------------------------------- palette
BG = (5, 7, 13)
BG2 = (8, 13, 24)
PANEL = (11, 18, 32)
PANEL2 = (16, 26, 45)
LINE = (29, 43, 69)
LINE2 = (47, 68, 104)
INK = (213, 226, 242)
DIM = (134, 152, 179)
FAINT = (124, 142, 169)
CYAN = (79, 209, 255)
GREEN = (62, 240, 138)
GREEN_DIM = (32, 132, 84)
AMBER = (245, 196, 81)
RED = (255, 84, 112)

S = 256          # logical grid
SCALE = 4        # 256 * 4 = 1024
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- 5x7 font
FONT: dict[str, list[str]] = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00100", "00100"],
    ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
    ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "·": ["00000", "00000", "00000", "00100", "00000", "00000", "00000"],
}


def text_width(txt: str, sc: int = 1, gap: int = 1) -> int:
    return len(txt) * (5 * sc + gap * sc) - gap * sc


def draw_text(
    d: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    txt: str,
    color: tuple[int, int, int],
    sc: int = 1,
    gap: int = 1,
) -> None:
    x0, y0 = xy
    step = (5 + gap) * sc
    for i, ch in enumerate(txt.upper()):
        glyph = FONT.get(ch, FONT[" "])
        for row, bits in enumerate(glyph):
            for col, bit in enumerate(bits):
                if bit == "1":
                    x = x0 + i * step + col * sc
                    y = y0 + row * sc
                    d.rectangle([x, y, x + sc - 1, y + sc - 1], fill=color)


def draw_text_rgb(img: Image.Image, xy, txt, color, sc=1, gap=1):
    draw_text(ImageDraw.Draw(img), xy, txt, color, sc, gap)


# ---------------------------------------------------------------- avatar
AVATAR = [
    "................",
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "..HHHHHHHHHHHH..",
    "..hhhhhhhhhhhh..",
    "...SSSSSSSSSS...",
    "...SSSSSSSSSS...",
    "...SSEESSEESS...",
    "...SSSSSSSSSS...",
    "...SSSSSSSSSS...",
    "...SSSSMMSSSS...",
    "...sSSSSSSSSs...",
    "....sSSSSSSs....",
    "...CCCCCCCCCC...",
    "..CCCCCCCCCCCC..",
    "..cccccccccccc..",
]
AV_COLORS = {
    "H": (200, 204, 212),
    "h": (136, 141, 152),
    "S": (224, 168, 120),
    "s": (184, 127, 82),
    "E": (26, 31, 43),
    "M": (150, 90, 70),
    "C": (42, 53, 80),
    "c": (26, 34, 54),
}


def draw_avatar(d: ImageDraw.ImageDraw, x: int, y: int, px: int = 3, bg=PANEL) -> None:
    d.rectangle([x, y, x + 16 * px - 1, y + 16 * px - 1], fill=bg)
    for r, row in enumerate(AVATAR):
        for c, ch in enumerate(row):
            if ch in AV_COLORS:
                d.rectangle(
                    [x + c * px, y + r * px, x + c * px + px - 1, y + r * px + px - 1],
                    fill=AV_COLORS[ch],
                )


# ---------------------------------------------------------------- pass icon
PASS_X0, PASS_Y0, PASS_X1, PASS_Y1 = 34, 22, 222, 234
BODY_X = PASS_X0 + 10
BODY_R = PASS_X1 - 10
HEADER_H = 26


def build_passport() -> Image.Image:
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img)

    # faint background grid
    for gx in range(0, S, 16):
        d.line([(gx, 0), (gx, S)], fill=(9, 14, 24))
    for gy in range(0, S, 16):
        d.line([(0, gy), (S, gy)], fill=(9, 14, 24))

    # ---- document shadow + card
    sh = 5
    d.rectangle([PASS_X0 + sh, PASS_Y0 + sh, PASS_X1 + sh, PASS_Y1 + sh], fill=(2, 3, 7))
    d.rectangle([PASS_X0, PASS_Y0, PASS_X1, PASS_Y1], fill=PANEL)
    d.rectangle([PASS_X0, PASS_Y0, PASS_X1, PASS_Y1], outline=LINE2, width=2)
    # top-left corner notch detail
    d.line([(PASS_X0 + 2, PASS_Y0 + 2), (PASS_X0 + 14, PASS_Y0 + 2)], fill=CYAN)
    d.line([(PASS_X0 + 2, PASS_Y0 + 2), (PASS_X0 + 2, PASS_Y0 + 14)], fill=CYAN)

    # ---- header
    hy1 = PASS_Y0 + HEADER_H
    d.rectangle([PASS_X0 + 2, PASS_Y0 + 2, PASS_X1 - 2, hy1], fill=PANEL2)
    d.line([(PASS_X0 + 2, hy1), (PASS_X1 - 2, hy1)], fill=LINE2, width=1)
    draw_text(d, (BODY_X, PASS_Y0 + 10), "AI SERVICE BORDER", CYAN, 1, 1)
    w04 = text_width("WINDOW 04", 1, 1)
    draw_text(d, (BODY_R - w04, PASS_Y0 + 10), "WINDOW 04", AMBER, 1, 1)

    # ---- avatar
    av_y = PASS_Y0 + 40
    d.rectangle([BODY_X - 1, av_y - 1, BODY_X + 50, av_y + 50], outline=LINE2, width=1)
    draw_avatar(d, BODY_X + 2, av_y + 2, px=3)

    # ---- identity block
    nx = BODY_X + 60
    draw_text(d, (nx, av_y - 1), "SURNAME / NAME", FAINT, 1, 1)
    draw_text(d, (nx, av_y + 10), "MIRA CHEN", INK, 2, 1)
    draw_text(d, (nx, av_y + 34), "PL-3793371", DIM, 1, 1)
    draw_text(d, (nx, av_y + 44), "DAY 01 · 09:04", FAINT, 1, 1)

    # ---- dashed divider
    dy = av_y + 56
    for x in range(BODY_X, BODY_R, 6):
        d.line([(x, dy), (min(x + 3, BODY_R), dy)], fill=LINE)

    # ---- data rows
    rows = [("IP REGION", "KA-01")]
    ry = dy + 8
    for k, v in rows:
        draw_text(d, (BODY_X + 2, ry), k, FAINT, 1, 1)
        vw = text_width(v, 1, 1)
        draw_text(d, (BODY_R - vw - 2, ry), v, DIM, 1, 1)
        ry += 12

    return img


def build_stamp_layer() -> Image.Image:
    """Unrotated stamp, drawn in its own box on a transparent layer."""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bx, by, bw, bh = 40, 150, 176, 62
    # border + inner rule
    d.rectangle([bx, by, bx + bw, by + bh], outline=GREEN + (255,), width=3)
    d.rectangle([bx + 6, by + 6, bx + bw - 6, by + bh - 6], outline=GREEN_DIM + (255,), width=1)

    title = "APPROVED"
    tw = text_width(title, 3, 1)
    draw_text(d, (bx + (bw - tw) // 2, by + 9), title, GREEN, 3, 1)

    sub = "WINDOW 04 · AI SERVICE"
    sw = text_width(sub, 1, 1)
    draw_text(d, (bx + (bw - sw) // 2, by + 38), sub, GREEN, 1, 1)
    return layer


def compose_passport() -> Image.Image:
    base = build_passport().convert("RGBA")
    stamp = build_stamp_layer().rotate(-8, resample=Image.NEAREST, center=(128, 190))
    base.alpha_composite(stamp)
    return base


# ---------------------------------------------------------------- effects
def upsample(img: Image.Image) -> Image.Image:
    return img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)


def add_glow(final: Image.Image, mask_small: Image.Image, color, radius=26, gain=0.55):
    """Screen a blurred colored copy of mask over final."""
    m = upsample(mask_small)
    glow = Image.new("RGB", final.size, (0, 0, 0))
    glow.paste(color, (0, 0), m)
    glow = glow.filter(ImageFilter.GaussianBlur(radius))
    glow = glow.point(lambda v: int(v * gain))
    return ImageChops.add(final, glow)


def finish(img_small: Image.Image, glow_mask: Image.Image | None) -> Image.Image:
    out = upsample(img_small.convert("RGB"))
    if glow_mask is not None:
        out = add_glow(out, glow_mask, GREEN, radius=30, gain=0.62)

    # radial cyan halo at the top, screen-blended
    halo = Image.new("L", (64, 64), 0)
    hd = ImageDraw.Draw(halo)
    for i in range(24, 0, -1):
        v = int(70 * (1 - i / 24) ** 2)
        hd.ellipse([32 - i, 30 - i, 32 + i, 30 + i], fill=v)
    halo = halo.resize(out.size, Image.BICUBIC)
    cy = Image.new("RGB", out.size, (0, 0, 0))
    cy.paste((20, 60, 90), (0, 0), halo)
    out = ImageChops.add(out, cy)

    # scanlines every 4 screen px
    sl = Image.new("L", out.size, 0)
    sd = ImageDraw.Draw(sl)
    for y in range(0, out.height, 4):
        sd.line([(0, y), (out.width, y)], fill=26)
    out = Image.composite(Image.new("RGB", out.size, (0, 0, 0)), out, sl.point(lambda v: v // 3))

    # corner vignette
    vig = Image.new("L", (64, 64), 0)
    vd = ImageDraw.Draw(vig)
    vd.rectangle([0, 0, 63, 63], fill=255)
    vd.rounded_rectangle([10, 10, 53, 53], radius=10, fill=0)
    vig = vig.filter(ImageFilter.GaussianBlur(6)).resize(out.size, Image.BICUBIC)
    out = Image.composite(Image.new("RGB", out.size, (2, 3, 6)), out, vig.point(lambda v: v // 2))
    return out


# ---------------------------------------------------------------- favicon mark
def build_favicon(size: int) -> Image.Image:
    """Native small mark: window 04 in a stamp frame. Drawn per size, never blurred."""
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    if size >= 32:
        d.rectangle([1, 1, size - 2, size - 2], fill=PANEL, outline=LINE2, width=1)
        d.rectangle([2, 2, size - 3, 7], fill=PANEL2)
        d.line([(2, 8), (size - 3, 8)], fill=LINE, width=1)
        d.rectangle([6, 4, 14, 5], fill=(30, 52, 82))
        d.rectangle([24, 4, 26, 5], fill=AMBER)
        tw = text_width("04", 2, 1)
        draw_text(d, ((size - tw) // 2, 11), "04", GREEN, 2, 1)
        d.rectangle([6, size - 4, size - 7, size - 4], fill=GREEN_DIM)
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=PANEL, outline=LINE2, width=1)
        d.rectangle([12, 2, 14, 3], fill=AMBER)
        tw = text_width("04", 1, 1)
        draw_text(d, ((size - tw) // 2, 5), "04", GREEN, 1, 1)
        d.rectangle([3, size - 2, size - 4, size - 2], fill=GREEN_DIM)
    return img


def write_ico(path: str, entries: list[tuple[int, Image.Image]]) -> None:
    """Minimal PNG-in-ICO writer (Vista+), one artwork per size."""
    import struct

    blobs = []
    for size, im in entries:
        assert im.size == (size, size)
        buf = __import__("io").BytesIO()
        im.save(buf, format="PNG", optimize=True)
        blobs.append((size, buf.getvalue()))
    out = bytearray(struct.pack("<HHH", 0, 1, len(blobs)))
    offset = 6 + 16 * len(blobs)
    for size, data in blobs:
        b = 0 if size >= 256 else size
        out += struct.pack("<BBBBHHII", b, b, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    for _, data in blobs:
        out += data
    with open(path, "wb") as f:
        f.write(out)


# ---------------------------------------------------------------- cover 3:4
CW, CH = 384, 512          # logical cover grid
CSCALE = 3                 # 384*3 x 512*3 = 1152 x 1536
CJK_PATH = "/System/Library/Fonts/Hiragino Sans GB.ttc"
CJK_FONT = ImageFont.truetype(CJK_PATH, 15, index=0)


def cjk_width(txt: str, size: int, tracking: int = 1) -> int:
    font = ImageFont.truetype(CJK_PATH, size, index=0)
    return int(sum(font.getlength(ch) for ch in txt) + tracking * max(0, len(txt) - 1))


def draw_cjk(img: Image.Image, xy, txt: str, size: int, color, tracking: int = 1) -> None:
    """1-bit pixelated CJK (render small, threshold, never antialias)."""
    font = ImageFont.truetype(CJK_PATH, size, index=0)
    w = cjk_width(txt, size, tracking) + size
    mask = Image.new("L", (w, size * 2), 0)
    md = ImageDraw.Draw(mask)
    x = 0
    for ch in txt:
        md.text((x, 0), ch, font=font, fill=255)
        x += font.getlength(ch) + tracking
    mask = mask.point(lambda v: 255 if v >= 96 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return
    mask = mask.crop(bbox)
    img.paste(color, xy, mask)


def build_cover() -> Image.Image:
    img = Image.new("RGB", (CW, CH), BG)
    d = ImageDraw.Draw(img)

    # backdrop grid
    for gx in range(0, CW, 16):
        d.line([(gx, 0), (gx, CH)], fill=(9, 14, 24))
    for gy in range(0, CH, 16):
        d.line([(0, gy), (CW, gy)], fill=(9, 14, 24))

    # frame + corner brackets
    d.rectangle([12, 12, CW - 13, CH - 13], outline=LINE2, width=2)
    for cx, cy, dx, dy in ((12, 12, 1, 1), (CW - 13, 12, -1, 1), (12, CH - 13, 1, -1), (CW - 13, CH - 13, -1, -1)):
        d.line([(cx, cy), (cx + 16 * dx, cy)], fill=CYAN)
        d.line([(cx, cy), (cx, cy + 16 * dy)], fill=CYAN)

    # header micro line
    head = "AI SERVICE BORDER · WINDOW 04"
    hw = text_width(head, 1, 1)
    draw_text(d, ((CW - hw) // 2, 26), head, FAINT, 1, 1)
    d.rectangle([(CW - hw) // 2 - 10, 28, (CW - hw) // 2 - 7, 30], fill=AMBER)
    d.rectangle([(CW + hw) // 2 + 7, 28, (CW + hw) // 2 + 10, 30], fill=AMBER)

    # title: shadow + glyphs
    def title(txt, y, sc, comma_cyan=False):
        tw = text_width(txt, sc, 2)
        x = (CW - tw) // 2
        for i, ch in enumerate(txt):
            gx = x + i * (7 * sc)
            for ox, oy, col in ((3, 4, (8, 16, 30)), (0, 0, INK)):
                draw_text(d, (gx + ox, y + oy), ch, col, sc, 2)
        if comma_cyan:
            draw_text(d, (x + (len(txt) - 1) * 7 * sc, y), ",", CYAN, sc, 2)

    title("AI,", 48, 8)
    title("PLEASE", 112, 8)

    # dashed divider
    y = 184
    for x in range(32, CW - 31, 10):
        d.line([(x, y), (min(x + 6, CW - 32), y)], fill=LINE2)

    # chinese subtitle (pixelated 1-bit)
    sub = "边境审核模拟器 · 04 号窗口"
    sw = cjk_width(sub, 15, 1)
    draw_cjk(img, ((CW - sw) // 2, 196), sub, 15, INK)

    en = "AI SERVICE BORDER INSPECTOR"
    ew = text_width(en, 1, 2)
    draw_text(d, ((CW - ew) // 2, 226), en, FAINT, 1, 2)

    # ---- passport card
    cx0, cy0, cx1, cy1 = 87, 244, 297, 452
    d.rectangle([cx0 + 5, cy0 + 6, cx1 + 5, cy1 + 6], fill=(2, 3, 7))
    d.rectangle([cx0, cy0, cx1, cy1], fill=PANEL)
    d.rectangle([cx0, cy0, cx1, cy1], outline=LINE2, width=2)

    d.rectangle([cx0 + 2, cy0 + 2, cx1 - 2, cy0 + 22], fill=PANEL2)
    d.line([(cx0 + 2, cy0 + 23), (cx1 - 2, cy0 + 23)], fill=LINE2, width=1)
    draw_text(d, (cx0 + 10, cy0 + 8), "PASSPORT · V-001", CYAN, 1, 1)
    w04 = text_width("W04 · D01", 1, 1)
    draw_text(d, (cx1 - 10 - w04, cy0 + 8), "W04 · D01", AMBER, 1, 1)

    d.rectangle([cx0 + 10 - 1, cy0 + 32 - 1, cx0 + 66 + 1, cy0 + 32 + 57], outline=LINE2, width=1)
    draw_avatar(d, cx0 + 12, cy0 + 34, px=3)

    nx = cx0 + 76
    draw_text(d, (nx, cy0 + 32), "SURNAME / NAME", FAINT, 1, 1)
    draw_text(d, (nx, cy0 + 42), "MIRA CHEN", INK, 2, 1)
    draw_text(d, (nx, cy0 + 62), "PL-3793371", DIM, 1, 1)
    draw_text(d, (nx, cy0 + 74), "SERVICE GPT-NOVA", DIM, 1, 1)
    draw_text(d, (nx, cy0 + 86), "DAY 01 · 09:04", FAINT, 1, 1)

    ry = cy0 + 94
    for x in range(cx0 + 10, cx1 - 10, 6):
        d.line([(x, ry), (min(x + 3, cx1 - 10), ry)], fill=LINE)
    draw_text(d, (cx0 + 12, ry + 6), "IP REGION", FAINT, 1, 1)
    draw_text(d, (cx0 + 12, ry + 18), "LANGUAGE", FAINT, 1, 1)
    for val, yy in (("KA-01", ry + 6), ("zh-CN", ry + 18)):
        vw = text_width(val, 1, 1)
        draw_text(d, (cx1 - 12 - vw, yy), val, DIM, 1, 1)

    # ---- footer stats
    for x in range(32, CW - 31, 10):
        d.line([(x, 458), (min(x + 6, CW - 32), 458)], fill=LINE)
    stats = "4 天 · 46 位访客 · 7 条规则 · 双结局"
    stw = cjk_width(stats, 12, 1)
    draw_cjk(img, ((CW - stw) // 2, 467), stats, 12, DIM)
    url = "LUSUALLEN.GITHUB.IO/AI-PLEASE"
    uw = text_width(url, 1, 2)
    draw_text(d, ((CW - uw) // 2, 485), url, FAINT, 1, 2)
    return img


def build_cover_stamp() -> Image.Image:
    layer = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bx, by, bw, bh = 101, 376, 182, 60
    d.rectangle([bx, by, bx + bw, by + bh], outline=GREEN + (255,), width=3)
    d.rectangle([bx + 5, by + 5, bx + bw - 5, by + bh - 5], outline=GREEN_DIM + (255,), width=1)
    title_txt = "APPROVED"
    tw = text_width(title_txt, 3, 1)
    draw_text(d, (bx + (bw - tw) // 2, by + 8), title_txt, GREEN, 3, 1)
    sub = "WINDOW 04 · AI SERVICE"
    sw = text_width(sub, 1, 1)
    draw_text(d, (bx + (bw - sw) // 2, by + 38), sub, GREEN, 1, 1)
    return layer.rotate(-7, resample=Image.NEAREST, center=(192, 406))


def compose_cover() -> tuple[Image.Image, Image.Image]:
    base = build_cover()
    stamp = build_cover_stamp()
    base = base.convert("RGBA")
    base.alpha_composite(stamp)
    return base.convert("RGB"), stamp.split()[3]


def finish_cover(small: Image.Image, stamp_mask: Image.Image, title_mask: Image.Image) -> Image.Image:
    out = small.resize((small.width * CSCALE, small.height * CSCALE), Image.NEAREST).convert("RGB")

    # radial cyan top / purple bottom
    radial = Image.radial_gradient("L").resize((out.width * 2, out.width * 2), Image.BICUBIC).point(lambda v: 255 - v)
    for color, pos, gain in (((16, 52, 78), (0, -out.width // 2), 0.55), ((44, 30, 74), (0, out.height - out.width // 2), 0.55)):
        tint = Image.new("RGB", out.size, (0, 0, 0))
        glow = radial.crop((0, 0, out.width, out.height)) if False else radial.resize(out.size, Image.BICUBIC)
        glow = glow.point(lambda v, g=gain: int(v * g))
        tint.paste(color, (0, 0), glow)
        out = ImageChops.add(out, tint)

    # title glow
    tm = title_mask.resize(out.size, Image.NEAREST).filter(ImageFilter.GaussianBlur(16))
    tg = Image.new("RGB", out.size, (0, 0, 0))
    tg.paste((22, 54, 84), (0, 0), tm)
    out = ImageChops.add(out, tg)

    # stamp glow
    out = add_glow(out, stamp_mask, GREEN, radius=26, gain=0.58)

    # CRT scanlines + vignette
    sl = Image.new("L", out.size, 0)
    sd = ImageDraw.Draw(sl)
    for y in range(0, out.height, 4):
        sd.line([(0, y), (out.width, y)], fill=22)
    out = Image.composite(Image.new("RGB", out.size, (0, 0, 0)), out, sl.point(lambda v: v // 3))
    return out


def title_mask_image() -> Image.Image:
    m = Image.new("L", (CW, CH), 0)
    md = ImageDraw.Draw(m)
    for txt, y in (("AI,", 48), ("PLEASE", 112)):
        tw = text_width(txt, 8, 2)
        x = (CW - tw) // 2
        draw_text(md, (x, y), txt, 255, 8, 2)
    return m


# ---------------------------------------------------------------- preview
def label(img, xy, txt, color, sc=1):
    draw_text(ImageDraw.Draw(img), xy, txt, color, sc, 1)


def make_contact_sheet(final: Image.Image, fav32: Image.Image, fav16: Image.Image) -> Image.Image:
    W, H = 1600, 800
    sheet = Image.new("RGB", (W, H), (4, 6, 11))
    d = ImageDraw.Draw(sheet)
    for gx in range(0, W, 32):
        d.line([(gx, 0), (gx, H)], fill=(8, 13, 22))
    for gy in range(0, H, 32):
        d.line([(0, gy), (W, gy)], fill=(8, 13, 22))

    label(sheet, (60, 44), "AI, PLEASE", CYAN, 3)
    label(sheet, (60, 92), "PIXEL ICON · 1024 x 1024 · 1:1 · BORDER CONTROL / WINDOW 04", FAINT, 1)

    sheet.paste(final.resize((512, 512), Image.LANCZOS), (60, 130))
    label(sheet, (60, 656), "MASTER 1024 → 512 PREVIEW · 143 KB · RGB / NO ALPHA", FAINT, 1)

    x = 660
    for size in (256, 128, 64):
        sheet.paste(final.resize((size, size), Image.LANCZOS), (x, 130))
        label(sheet, (x, 130 + size + 10), f"{size} PX", DIM, 1)
        x += size + 36

    label(sheet, (660, 418), "FAVICON · NATIVE MARKS", FAINT, 1)
    sheet.paste(fav32.resize((96, 96), Image.NEAREST), (660, 440))
    sheet.paste(fav16.resize((96, 96), Image.NEAREST), (790, 440))
    label(sheet, (660, 544), "32 PX NATIVE / X3", DIM, 1)
    label(sheet, (790, 544), "16 PX NATIVE / X6", DIM, 1)

    label(sheet, (660, 578), "ON LIGHT UI", FAINT, 1)
    d.rectangle([660, 600, 1500, 740], fill=(238, 240, 244))
    for i, size in enumerate((128, 64, 32)):
        sheet.paste(final.resize((size, size), Image.LANCZOS), (700 + i * 200, 604 + (128 - size) // 2))
    label(sheet, (660, 756), "OPAQUE · DARK-FIRST PALETTE", FAINT, 1)
    return sheet


def mask_from_composite_stamp() -> Image.Image:
    stamp = build_stamp_layer()
    rotated = stamp.rotate(-8, resample=Image.NEAREST, center=(128, 190))
    return rotated.split()[3]


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT_DIR, name)
    img.save(path, optimize=True)
    print(f"{name}: {img.size[0]}x{img.size[1]}  {os.path.getsize(path)/1024:.0f} KB")


def main() -> None:
    base = compose_passport()
    final = finish(base, mask_from_composite_stamp())
    save(final, "ai-please-icon-1024.png")

    for size in (512, 256, 128, 64):
        p = os.path.join(OUT_DIR, f"ai-please-icon-{size}.png")
        final.resize((size, size), Image.LANCZOS).save(p, optimize=True)
        print(f"ai-please-icon-{size}.png: {size}x{size}  {os.path.getsize(p)/1024:.0f} KB")

    fav32 = build_favicon(32)
    fav16 = build_favicon(16)
    fav32.save(os.path.join(OUT_DIR, "favicon-32.png"), optimize=True)
    fav16.save(os.path.join(OUT_DIR, "favicon-16.png"), optimize=True)
    sheet = make_contact_sheet(final, fav32, fav16)
    save(sheet, "preview-contact-sheet.png")

    cover, cover_stamp = compose_cover()
    cover_final = finish_cover(cover, cover_stamp, title_mask_image())
    save(cover_final, "ai-please-cover-1152x1536.png")
    cover_final.resize((768, 1024), Image.LANCZOS).save(
        os.path.join(OUT_DIR, "ai-please-cover-768x1024.png"), optimize=True
    )
    print("ai-please-cover-768x1024.png: 768x1024")

    write_ico(
        os.path.join(OUT_DIR, "ai-please-icon.ico"),
        [
            (16, fav16),
            (32, fav32),
            (48, build_favicon(48)),
            (64, final.resize((64, 64), Image.LANCZOS)),
            (128, final.resize((128, 128), Image.LANCZOS)),
            (256, final.resize((256, 256), Image.LANCZOS)),
        ],
    )
    print("ai-please-icon.ico: 16/32/48 mark + 64/128/256 artwork")


if __name__ == "__main__":
    main()
