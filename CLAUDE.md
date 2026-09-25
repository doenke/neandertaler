# Neandertaler – Hinweise für Claude

Statische PWA (HTML/CSS/JS, kein Build) mit Karten, Timer und Punktezähler für
„Poesie für Neandertaler“. Details in `README.md`, Deployment in `DEPLOYMENT.md`.

## Arbeitsweise

- Sprache in Code-Kommentaren, Texten und Commits: Deutsch.
- Es gibt nur den Branch `main`. Jeder Push auf `main` deployt per SFTP auf den
  Webspace (`.github/workflows/deploy.yml`). Vor dem Push prüfen, dass alles läuft.

## Karten erstellen

Karten stehen in `tools/cards.txt` (`1-Punkt-Wort | 3-Punkt-Begriff`, Kategorien
mit `## Name`). `data/cards.de.json` wird daraus erzeugt, nie von Hand bearbeiten.

**Keine Doppelungen, weder zum bestehenden Set noch innerhalb neuer Karten.**
Das gilt für 1-Punkt-Wörter und für 3-Punkt-Begriffe, Groß-/Kleinschreibung egal.

- Vor dem Ausdenken neuer Karten alle vorhandenen 1-Punkt-Wörter und
  3-Punkt-Begriffe aus `tools/cards.txt` einlesen und dagegen prüfen.
- Auch keine Beinahe-Doppelungen: kein 3er, der nur ein bestehender 3er mit
  Zusatz ist („Sandburg“ → „Sandburg bauen“), keine künstlich angehängten
  Ortsangaben („Spinnennetz im Keller“), keine Singular/Plural-Varianten eines
  vorhandenen 1-Punkt-Worts.
- Nach dem Bearbeiten `python3 tools/build-cards.py` ausführen. Es bricht bei
  doppelten 1-Punkt-Wörtern oder 3-Punkt-Begriffen ab und muss fehlerfrei
  durchlaufen. Treffer durch neue Wörter in den **neuen** Karten ersetzen.
- Bestehende Karten nicht umformulieren, außer auf ausdrücklichen Wunsch: die
  Karten-ID ist ein Hash des Texts, sonst geht der „schon gespielt“-Status
  verloren.
- 1-Punkt-Wort: ein einfaches Wort. 3-Punkt-Begriff: thematisch verbunden
  (Kompositum, Redewendung, bekannte Figur oder Werk), familientauglich.
- Anzahl in `README.md` („rund … Kartenpaare in … Kategorien“) mitziehen.
