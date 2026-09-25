# Neandertaler

Handyoptimierte, offlinefähige PWA für das Spiel **Poesie für Neandertaler**:
zieht neue Karten, misst die Zeit pro Zug und zählt die Punkte beider Teams.

Alles ist statisches HTML/CSS/JS – kein Build, kein Backend. Es genügt, den Ordner
über HTTPS auszuliefern. Das Deployment auf den eigenen Webspace läuft per SFTP
aus GitHub Actions, siehe [DEPLOYMENT.md](DEPLOYMENT.md).

## Funktionen

- **Karten**: rund 1950 eigene Kartenpaare in 26 Kategorien – oben das
  1-Punkt-Wort, darunter der 3-Punkt-Begriff. Kategorien lassen sich abwählen.
  Die App merkt sich über Spiele hinweg, welche Karten schon dran waren, und zieht
  zuerst ungespielte. Sind alle durch, wird neu gemischt.
- **Zug**: „Zug starten“ deckt die erste Karte auf und startet den Timer
  (Standard 90 s, einstellbar 30–180 s). Ab 10 s wird er rot, die letzten
  5 s piepen, am Ende gibt es Ton und Vibration.
- **Wertung**:
  - **+1** – das Wort ist erraten; die Karte bleibt liegen, der 3er ist jetzt dran.
  - **+3** – der Begriff ist erraten. Die Karte zählt dann 3 Punkte, auch wenn
    vorher schon +1 gedrückt wurde.
  - **Weiter** – nach einem +1 zur nächsten Karte, der Punkt bleibt.
  - **Bonk!** / **Überspringen** – die Karte verfällt, auch ein schon erratenes
    Wort. Standard: **−1 fürs aktive Team**; in den Einstellungen umschaltbar auf
    „+1 fürs andere Team“ oder „keine Wertung“.
  - **Rückgängig** nimmt die letzte Aktion zurück, auch nach Ablauf der Zeit.
  - Tippen auf einen Punktestand öffnet eine ±1-Korrektur.
- **Zusammenfassung** nach jedem Zug: welche Karten wie gewertet wurden.
- **Spielende** optional bei einer Zielpunktzahl, sonst über das Menü.
- **Pause**, Menü „Anderes Team ist dran“, Bildschirm bleibt während des Zugs an
  (Wake Lock).
- Spielstand, Einstellungen und gespielte Karten liegen in `localStorage` und
  überstehen Neuladen und Appwechsel. Ein laufender Timer läuft weiter.
- **Installierbar** als App, komplett offline nutzbar.

## Karten ergänzen

Die Karten stehen lesbar in `tools/cards.txt`, eine pro Zeile:

```
## Tiere
Hund | Hundehütte
```

Danach

```bash
python3 tools/build-cards.py
```

Das Skript prüft auf doppelte 3-Punkt-Begriffe und kaputte Zeilen und schreibt
`data/cards.de.json`. Beide Dateien committen. Die ID einer Karte ergibt sich aus
ihrem Text; wer eine Karte umformuliert, macht daraus für die App eine neue Karte.

## Lokal ausprobieren

```bash
python3 -m http.server 8000
```

und `http://localhost:8000` öffnen. Der Service Worker läuft auf `localhost`
auch ohne HTTPS; auf dem Webspace braucht die Installation als App HTTPS.

## Dateien

| Datei | Zweck |
| --- | --- |
| `index.html` | App-Shell mit Start, Spiel und Dialogen |
| `css/style.css` | Gestaltung, mobile first, hell/dunkel |
| `js/app.js` | Spielablauf, Wertung, Timer, Einstellungen |
| `js/deck.js` | Kartenstapel: laden, mischen, ziehen, gespielte Karten merken |
| `data/cards.de.json` | Kartenliste (erzeugt) |
| `sw.js` | Service Worker, offline-Cache |
| `manifest.webmanifest`, `icons/` | Installation als App |
| `tools/` | Kartenquelle und Build-Skript (wird nicht hochgeladen) |
| `.github/workflows/deploy.yml` | SFTP-Deployment |
