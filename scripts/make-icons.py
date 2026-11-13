"""Rebuild the owner's "J." favicon as a vector and render the icon set.

Geometry is measured from public/favicon.ico (76x76): a white J (stem, bottom
bar with rounded outer corners, short left hook) and a square dot, on #333.
Everything is drawn in that 76-unit grid and scaled.

usage: python scripts/make-icons.py public
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

BG = (51, 51, 51, 255)
INK = (255, 255, 255, 255)
R = 4  # outer corner radius of the J's bottom, in grid units

SVG_PATH = "M34 19h9v33a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4V38h9v11h16Z"
SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76">'
    f'<rect width="76" height="76" fill="#333"/>'
    f'<path fill="#fff" d="{SVG_PATH}"/>'
    '<rect x="57" y="45" width="11" height="11" fill="#fff"/>'
    "</svg>\n"
)


def render(size: int, pad: float = 0.0) -> Image.Image:
    """Draw at 8x and downsample, so edges are antialiased. `pad` insets the mark (maskable icons)."""
    ss = 8
    big = size * ss
    im = Image.new("RGBA", (big, big), BG)
    d = ImageDraw.Draw(im)
    inner = big * (1 - 2 * pad)
    off = big * pad
    u = inner / 76

    def box(x0, y0, x1, y1):
        return [off + x0 * u, off + y0 * u, off + x1 * u - 1, off + y1 * u - 1]

    # The J: stem, bottom bar with rounded outer corners, left hook.
    d.rounded_rectangle(box(9, 47, 43, 56), radius=R * u, fill=INK)
    d.rectangle(box(34, 19, 43, 50), fill=INK)
    d.rectangle(box(9, 38, 18, 50), fill=INK)
    # The dot.
    d.rectangle(box(57, 45, 68, 56), fill=INK)
    return im.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = Path(sys.argv[1])
    (out / "icon.svg").write_text(SVG, encoding="utf-8")
    # Google wants a favicon that is a multiple of 48px square.
    render(48).save(out / "favicon-48x48.png")
    render(96).save(out / "favicon-96x96.png")
    render(180).convert("RGB").save(out / "apple-touch-icon.png")
    render(192).save(out / "icon-192.png")
    render(512).save(out / "icon-512.png")
    render(512, pad=0.1).save(out / "icon-maskable-512.png")
    # Organization logo for structured data: at least 112x112, crawlable.
    render(512).convert("RGB").save(out / "images" / "logo.png")
    manifest = {
        "name": "Jan Kevin Cadampog",
        "short_name": "JKC",
        "start_url": "/",
        "display": "browser",
        "background_color": "#f6f4ef",
        "theme_color": "#333333",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            {"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml"},
        ],
    }
    (out / "site.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    # Check against the original at its own size.
    orig = Image.open(out / "favicon.ico").convert("RGBA")
    mine = render(76)
    diff = sum(
        1
        for x in range(76)
        for y in range(76)
        if abs(orig.getpixel((x, y))[0] - mine.getpixel((x, y))[0]) > 96
    )
    print("pixels differing strongly from favicon.ico:", diff, "of", 76 * 76)


if __name__ == "__main__":
    main()
