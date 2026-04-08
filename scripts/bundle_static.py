"""
Generate app/static_assets.py from public/embed.html and public/widget.js.

Vercel's @vercel/python runtime only bundles files reachable via imports, so
static assets in public/ don't make it onto the lambda. This script inlines
them into a Python module that IS imported, guaranteeing they ship with the
deployment.

Re-run whenever you change public/embed.html or public/widget.js:
    python scripts/bundle_static.py
"""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
OUT = ROOT / "app" / "static_assets.py"


def encode(path: Path) -> str:
    data = path.read_bytes()
    return base64.b64encode(data).decode("ascii")


def main():
    embed_b64 = encode(PUBLIC / "embed.html")
    widget_b64 = encode(PUBLIC / "widget.js")

    content = (
        "# Auto-generated from public/ by scripts/bundle_static.py.\n"
        "# Do not edit by hand.\n"
        "import base64\n\n"
        f"EMBED_HTML = base64.b64decode({embed_b64!r}).decode('utf-8')\n\n"
        f"WIDGET_JS = base64.b64decode({widget_b64!r}).decode('utf-8')\n"
    )
    OUT.write_text(content, encoding="utf-8")
    print(f"[OK] Wrote {OUT} ({len(embed_b64)} + {len(widget_b64)} base64 chars)")


if __name__ == "__main__":
    main()
