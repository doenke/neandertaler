#!/usr/bin/env python3
"""Prüft neue Karten gegen das bestehende Set, bevor sie in cards.txt kommen.

Aufruf:  python3 tools/check-new-cards.py neue-karten.txt

Die Datei hat dasselbe Format wie cards.txt (`## Kategorie`, `Wort | Begriff`).
Gültige Zeilen gehen nach stdout, Konflikte mit Grund nach stderr – geprüft
wird gegen cards.txt und gegen die bereits geprüften neuen Zeilen:
doppeltes 1-Punkt-Wort, doppelter 3-Punkt-Begriff, kein Kompositum.
"""
import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build", HERE / "build-cards.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def card_lines(text):
    for line in text.splitlines():
        if "|" in line and not line.lstrip().startswith("#"):
            one, three = (x.strip() for x in line.split("|", 1))
            yield line, one, three


def main():
    ones, threes = set(), set()
    for _, one, three in card_lines((HERE / "cards.txt").read_text(encoding="utf-8")):
        ones.add(one.casefold())
        threes.add(three.casefold())

    ok = bad = 0
    for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
        if "|" not in line or line.lstrip().startswith("#"):
            print(line)
            continue
        one, three = (x.strip() for x in line.split("|", 1))
        if one.casefold() in ones:
            why = "1-Punkt-Wort gibt es schon"
        elif three.casefold() in threes:
            why = "3-Punkt-Begriff gibt es schon"
        elif not build.is_compound_of(one, three):
            why = "kein zusammengesetztes Wort mit dem 1-Punkt-Wort"
        else:
            ones.add(one.casefold())
            threes.add(three.casefold())
            print(line)
            ok += 1
            continue
        print(f"{why}: {line}", file=sys.stderr)
        bad += 1
    print(f"{ok} gültig, {bad} verworfen", file=sys.stderr)


if __name__ == "__main__":
    main()
