#!/usr/bin/env python3
"""Build a self-contained P808 short-batch page with no manifest fetch."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE_PAGE = ROOT / "p808-batch/index.html"
SOURCE_APP = ROOT / "p808-batch/app.js"
SOURCE_CSS = ROOT / "p808-batch/styles.css"
MANIFEST = ROOT / "p808-short/batch_manifest.json"
INDEX = ROOT / "p808-batch/batch_index.json"
OUTPUT = ROOT / "p808-short/index.html"


def main():
    page = SOURCE_PAGE.read_text()
    css = SOURCE_CSS.read_text()
    app = SOURCE_APP.read_text()
    manifest = json.loads(MANIFEST.read_text())
    index = json.loads(INDEX.read_text())
    manifest["batches"] = index["batches"]
    manifest["sample_count"] = index["sample_count"]
    manifest["__embedded"] = True
    data = json.dumps(manifest, ensure_ascii=False, separators=(",", ":"))
    page = page.replace('<link rel="stylesheet" href="styles.css">',
                        "<style>\n" + css + "\n</style>")
    page = page.replace('<script src="app.js?v=p808-batch-v5" defer></script>',
                        '<script>window.__P808_BATCH_INDEX__ = ' + data + ';</script>\n'
                        '<script>\n' + app + '\n</script>')
    page = page.replace('<script src="app.js?v=p808-batch-v6" defer></script>',
                        '<script>window.__P808_BATCH_INDEX__ = ' + data + ';</script>\n'
                        '<script>\n' + app + '\n</script>')
    OUTPUT.write_text(page)
    print(OUTPUT, OUTPUT.stat().st_size)


if __name__ == "__main__":
    main()
