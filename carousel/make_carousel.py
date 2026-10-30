import json, math, sys, os, re
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
M = 80
CREAM = (242, 235, 221)
INK = (20, 20, 20)
ORANGE = (255, 90, 31)
MUTED = (96, 90, 80)

FD = "/usr/share/fonts/opentype/inter/"
FM = "/mnt/skills/examples/canvas-design/canvas-fonts/"
SS = 2


def font(name, size):
    path = FM + name if name.startswith("JetBrains") else FD + name
    return ImageFont.truetype(path, size * SS)


def tracked(draw, xy, text, fnt, fill, track=0.0):
    x, y = xy
    if not track:
        draw.text((x, y), text, font=fnt, fill=fill)
        return draw.textlength(text, font=fnt)
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + track * SS
    return x - xy[0]


def wrap(draw, text, fnt, width, track=0.0):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        tw = draw.textlength(t, font=fnt) + track * SS * len(t)
        if tw > width * SS and cur:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    if len(lines) > 1 and " " not in lines[-1].replace(" ", " ").strip():
        prev = lines[-2].split(" ")
        if len(prev) > 1:
            cand = prev[-1] + " " + lines[-1]
            if draw.textlength(cand, font=fnt) + track * SS * len(cand) <= width * SS:
                lines[-2] = " ".join(prev[:-1])
                lines[-1] = cand
    return lines


SHORT = set("в во на с со к ко о об обо от до по за из у и а но не ни для без под над при про что как или же бы ли то".split())


def typo(text, keep_dot=False):
    text = text.strip()
    if not keep_dot and text.endswith(".") and not text.endswith("..."):
        text = text[:-1]
    words = text.split(" ")
    out = []
    for i, w in enumerate(words):
        out.append(w)
        if i == len(words) - 1:
            break
        nxt = words[i + 1]
        core = re.sub(r"[«»\"(),.:;!?]", "", w).lower()
        if core in SHORT or re.fullmatch(r"[\d–\-]+", core) or nxt in ("—", "–", "→") or nxt.lower() in ("же", "ли", "бы"):
            out.append(" ")
        else:
            out.append(" ")
    return "".join(out)


def label(draw, x, y, text, bg=ORANGE, fg=CREAM, size=28):
    f = font("JetBrainsMono-Regular.ttf", size)
    text = text.upper()
    tw = sum(draw.textlength(c, font=f) + 3 * SS for c in text)
    padx, h = int(size * 0.7) * SS, int(size * 1.9) * SS
    draw.rectangle([x * SS, y * SS, x * SS + tw + 2 * padx, y * SS + h], fill=bg)
    tracked(draw, (x * SS + padx, y * SS + h / 2 - size * SS * 0.62), text, f, fg, 3)
    return h / SS


def rings(draw, cx, cy, radii, col, w=3):
    for r in radii:
        draw.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], outline=col, width=w * SS)


def footer(draw, page, total, fg=INK, last=False):
    f = font("JetBrainsMono-Regular.ttf", 24)
    y = H - M - 10
    draw.rectangle([M * SS, (y - 28) * SS, (W - M) * SS, (y - 26) * SS], fill=fg)
    tracked(draw, (M * SS, (y - 10) * SS), "@designradar_lab", f, fg, 1)
    right = f"{page:02d} / {total:02d}" + ("" if last else "   листай →")
    rw = sum(draw.textlength(c, font=f) + 1 * SS for c in right)
    tracked(draw, ((W - M) * SS - rw, (y - 10) * SS), right, f, fg, 1)


def text_block(draw, x, y, text, fnt, fill, width, lh, track=0.0):
    text = typo(text)
    lines = wrap(draw, text, fnt, width, track)
    for i, ln in enumerate(lines):
        tracked(draw, (x * SS, (y + i * lh) * SS), ln, fnt, fill, track)
    return len(lines) * lh


def cover_card(spec, total):
    im = Image.new("RGB", (W * SS, H * SS), CREAM)
    d = ImageDraw.Draw(im)
    cx, cy = W - 260, H - 375
    rings(d, cx, cy, [55, 110, 165, 220], INK, 3)
    d.pieslice([(cx - 220) * SS, (cy - 220) * SS, (cx + 220) * SS, (cy + 220) * SS], 200, 245, fill=ORANGE)
    rings(d, cx, cy, [55, 110, 165, 220], INK, 3)
    d.ellipse([(cx - 14) * SS, (cy - 14) * SS, (cx + 14) * SS, (cy + 14) * SS], fill=INK)
    bx, by = cx + int(220 * math.cos(math.radians(222))), cy + int(220 * math.sin(math.radians(222)))
    d.ellipse([(bx - 26) * SS, (by - 26) * SS, (bx + 26) * SS, (by + 26) * SS], fill=INK)
    h = label(d, M, M, spec["label"])
    ft = font("InterDisplay-ExtraBold.otf", 104)
    y = M + h + 40
    used = text_block(d, M, y, spec["title"], ft, INK, W - 2 * M, 104, -2)
    fs = font("Inter-Medium.otf", 38)
    text_block(d, M, y + used + 28, spec["subtitle"], fs, MUTED, W - 2 * M - 120, 52)
    footer(d, 1, total)
    return im


def point_card(spec, n, page, total):
    im = Image.new("RGB", (W * SS, H * SS), CREAM)
    d = ImageDraw.Draw(im)
    label(d, M, M, spec.get("label", "чек-лист"), bg=INK, fg=CREAM, size=24)
    fn = font("InterDisplay-Black.otf", 220)
    d.text((M * SS - 10 * SS, (M + 90) * SS), f"{n:02d}", font=fn, fill=ORANGE)
    fh = font("InterDisplay-ExtraBold.otf", 80)
    y = M + 380
    used = text_block(d, M, y, spec["head"], fh, INK, W - 2 * M, 88, -1.5)
    fb = font("Inter-Medium.otf", 44)
    text_block(d, M, y + used + 36, spec["body"], fb, MUTED, W - 2 * M - 20, 60)
    if spec.get("check"):
        fc = font("Inter-SemiBold.otf", 38)
        lines = wrap(d, typo(spec["check"], keep_dot=True), fc, W - 2 * M - 110)
        box_h = 56 + len(lines) * 52
        yy = H - M - 80 - box_h
        d.rectangle([M * SS, yy * SS, (W - M) * SS, (yy + box_h) * SS], outline=INK, width=3 * SS)
        d.rectangle([M * SS, yy * SS, (M + 14) * SS, (yy + box_h) * SS], fill=ORANGE)
        for i, ln in enumerate(lines):
            d.text(((M + 50) * SS, (yy + 28 + i * 52) * SS), ln, font=fc, fill=INK)
    footer(d, page, total)
    return im


def final_card(spec, total):
    im = Image.new("RGB", (W * SS, H * SS), INK)
    d = ImageDraw.Draw(im)
    rings(d, W - 40, 260, [80, 160, 240, 320], (70, 66, 60), 3)
    label(d, M, M, "сохрани", bg=ORANGE, fg=INK)
    ft = font("InterDisplay-ExtraBold.otf", 88)
    y = M + 140
    used = text_block(d, M, y, spec["title"], ft, CREAM, W - 2 * M, 92, -2)
    fb = font("Inter-Medium.otf", 38)
    used2 = text_block(d, M, y + used + 36, spec["body"], fb, (200, 192, 178), W - 2 * M - 40, 54)
    yy = y + used + 36 + used2 + 60
    d.rectangle([M * SS, yy * SS, (W - M) * SS, (yy + 190) * SS], fill=ORANGE)
    fc = font("InterDisplay-ExtraBold.otf", 46)
    text_block(d, M + 40, yy + 36, spec["cta"], fc, INK, W - 2 * M - 80, 54, -1)
    fs = font("JetBrainsMono-Regular.ttf", 22)
    if spec.get("source"):
        tracked(d, (M * SS, (H - M - 90) * SS), spec["source"], fs, (160, 152, 140), 0.5)
    footer(d, total, total, fg=CREAM, last=True)
    return im


def build(spec, outdir):
    os.makedirs(outdir, exist_ok=True)
    pts = spec["points"]
    total = len(pts) + 2
    cards = [cover_card(spec["cover"], total)]
    for i, p in enumerate(pts):
        cards.append(point_card({**p, "label": spec["cover"]["label"]}, i + 1, i + 2, total))
    cards.append(final_card(spec["final"], total))
    paths = []
    for i, c in enumerate(cards):
        c = c.resize((W, H), Image.LANCZOS)
        p = os.path.join(outdir, f"card_{i+1:02d}.png")
        c.save(p, optimize=True)
        paths.append(p)
    th = 360
    tw = int(W * th / H)
    imgs = [Image.open(p).convert("RGB") for p in paths]
    sheet = Image.new("RGB", (tw * len(imgs) + 20 * (len(imgs) + 1), th + 40), (210, 204, 190))
    for i, im in enumerate(imgs):
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (20 + i * (tw + 20), 20))
    sheet.save(os.path.join(outdir, "sheet.png"))
    return paths


if __name__ == "__main__":
    spec = json.load(open(sys.argv[1]))
    print(build(spec, sys.argv[2]))
