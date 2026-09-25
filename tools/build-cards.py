#!/usr/bin/env python3
"""Erzeugt data/cards.de.json aus tools/cards.txt.

Aufruf:  python3 tools/build-cards.py
Bricht ab, wenn ein 3-Punkt-Begriff doppelt vorkommt oder eine Zeile kaputt ist.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "cards.txt"
DST = ROOT / "data" / "cards.de.json"


def card_id(one, three):
    # Stabil, solange der Wortlaut gleich bleibt.
    return hashlib.sha1(f"{one}|{three}".encode("utf-8")).hexdigest()[:8]


def main():
    cards, errors = [], []
    seen_three = {}
    cat = None
    for no, raw in enumerate(SRC.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("## "):
            cat = line[3:].strip()
            continue
        if line.startswith("#"):
            continue
        if cat is None:
            errors.append(f"Zeile {no}: Karte vor der ersten Kategorie")
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 2 or not all(parts):
            errors.append(f"Zeile {no}: erwartet 'Wort | Begriff', gefunden: {raw!r}")
            continue
        one, three = parts
        key = three.casefold()
        if key in seen_three:
            errors.append(f"Zeile {no}: '{three}' steht schon in Zeile {seen_three[key]}")
            continue
        seen_three[key] = no
        cards.append({"id": card_id(one, three), "one": one, "three": three, "cat": cat})

    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    cats = list(dict.fromkeys(c["cat"] for c in cards))
    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_text(
        json.dumps({"version": 1, "categories": cats, "cards": cards},
                   ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"{len(cards)} Karten in {len(cats)} Kategorien -> {DST.relative_to(ROOT)}")
    for c in cats:
        print(f"  {sum(1 for k in cards if k['cat'] == c):4d}  {c}")


if __name__ == "__main__":
    main()
