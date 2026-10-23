"""Synthetic Handwritten Assignments samples, for the smoke test and to check hw-eval runs.

These are text drawn in handwriting-style system fonts (Windows: Ink Free, Segoe Script,
Nirmala UI for Devanagari), with a little jitter. They are NOT real student handwriting
and must not be used to choose models; the real labelled sample set does that.

    python scripts/hw/make-synthetic-samples.py scripts/hw/samples
"""

import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONTS = "C:/Windows/Fonts"
SAMPLES = [
    ("en-photosynthesis", "en", "Inkfree.ttf", "Plants make there own food\nusing sun lite and water."),
    ("en-capital", "en", "segoesc.ttf", "New Delhi is the capital\nof India."),
    ("hi-paryavaran", "hi", "Nirmala.ttc", "पेड़ हमें ऑक्सीजन देते हैं।\nहमें पेड़ लगाने चाहिए।"),
]


def render(text: str, font_file: str, seed: int) -> Image.Image:
    rnd = random.Random(seed)
    font = ImageFont.truetype(f"{FONTS}/{font_file}", 42)
    lines = text.split("\n")
    width, line_h = 900, 70
    img = Image.new("L", (width, line_h * len(lines) + 40), 255)
    draw = ImageDraw.Draw(img)
    y = 20
    for line in lines:
        x = 24
        for word in line.split(" "):
            # Small per-word wobble so it is not perfectly typeset.
            draw.text((x, y + rnd.randint(-3, 3)), word, font=font, fill=rnd.randint(0, 40))
            x += draw.textlength(word + " ", font=font) + rnd.randint(-2, 4)
        y += line_h
    return img.rotate(rnd.uniform(-1.2, 1.2), fillcolor=255, expand=False)


def main(out_dir: str) -> None:
    out = Path(out_dir)
    for i, (name, lang, font, text) in enumerate(SAMPLES):
        d = out / name
        d.mkdir(parents=True, exist_ok=True)
        render(text, font, seed=i).save(d / "image.png", optimize=True)
        (d / "truth.txt").write_text(text, encoding="utf-8")
        (d / "meta.json").write_text(json.dumps({"language": lang, "kind": "ink", "synthetic": True}), encoding="utf-8")
        print(f"{d}/image.png  {(d / 'image.png').stat().st_size} bytes")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "scripts/hw/samples")
