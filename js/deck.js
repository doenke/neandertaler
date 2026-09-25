/* Kartenstapel: lädt die Wortliste, mischt und zieht ohne Wiederholung.
   Gespielte Karten werden über Spiele hinweg gemerkt, damit neue Spiele
   zuerst Karten bringen, die noch niemand gesehen hat. */
(function () {
  'use strict';

  const KEY_DECK = 'neandertaler:deck';
  const KEY_SEEN = 'neandertaler:seen';

  const load = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ohne Speicher weiter */ }
  };

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const Deck = {
    cards: [],          // alle Karten aus der JSON-Datei
    categories: [],
    byId: new Map(),
    order: [],          // IDs in Ziehreihenfolge
    pos: 0,
    seen: new Set(),
    disabled: new Set(),

    async load() {
      const res = await fetch('data/cards.de.json');
      if (!res.ok) throw new Error(`Karten nicht ladbar (${res.status})`);
      const data = await res.json();
      this.cards = data.cards;
      this.categories = data.categories;
      this.byId = new Map(this.cards.map((c) => [c.id, c]));
      this.seen = new Set(load(KEY_SEEN, []).filter((id) => this.byId.has(id)));
      const saved = load(KEY_DECK, null);
      if (saved && Array.isArray(saved.order)) {
        this.order = saved.order.filter((id) => this.byId.has(id));
        this.pos = Math.min(saved.pos | 0, this.order.length);
      }
    },

    /** Karten, die mit den aktuellen Kategorien infrage kommen. */
    pool() {
      return this.cards.filter((c) => !this.disabled.has(c.cat));
    },

    setDisabled(cats) {
      const next = new Set(cats);
      const changed = next.size !== this.disabled.size || [...next].some((c) => !this.disabled.has(c));
      this.disabled = next;
      if (changed && this.order.length) this.rebuild();
    },

    /** Neu mischen: ungesehene Karten zuerst, danach die schon gespielten. */
    rebuild() {
      const pool = this.pool().map((c) => c.id);
      const fresh = pool.filter((id) => !this.seen.has(id));
      const old = pool.filter((id) => this.seen.has(id));
      this.order = shuffle(fresh).concat(shuffle(old));
      this.pos = 0;
      this.persist();
    },

    /** Zieht die nächste Karte. Liefert {card, reshuffled}. */
    draw() {
      let reshuffled = false;
      if (this.pos >= this.order.length || !this.order.length) {
        // Alles aus dem Pool gespielt: Gedächtnis für diesen Pool leeren.
        if (this.pool().every((c) => this.seen.has(c.id))) {
          for (const c of this.pool()) this.seen.delete(c.id);
          reshuffled = true;
        }
        this.rebuild();
      }
      const id = this.order[this.pos++];
      const card = this.byId.get(id) || null;
      if (card) this.seen.add(card.id);
      this.persist();
      return { card, reshuffled };
    },

    /** Letzte Ziehung zurücknehmen (für „Rückgängig“). */
    setPos(pos) {
      this.pos = Math.max(0, Math.min(pos, this.order.length));
      this.persist();
    },

    remaining() {
      return Math.max(0, this.order.length - this.pos);
    },

    unseenCount() {
      return this.pool().filter((c) => !this.seen.has(c.id)).length;
    },

    resetSeen() {
      this.seen.clear();
      this.rebuild();
    },

    persist() {
      save(KEY_DECK, { order: this.order, pos: this.pos });
      save(KEY_SEEN, [...this.seen]);
    }
  };

  window.Deck = Deck;
})();
