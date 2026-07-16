import { initBooksModule, renderSidebar, openItemModal } from './books.js';
import { initTimelineModule, renderTimeline, openChapterModal } from './timeline.js';
import { loadStoredValue, saveStoredValue, loadStoredImages, persistImportedImages } from './storage.js';

const CATS = [
  { key: 'characters', label: 'Characters', color: '#c0654f' },
  { key: 'places', label: 'Places', color: '#4f7a6b' },
  { key: 'objects', label: 'Objects', color: '#a68a3f' },
  { key: 'lore', label: 'Lore', color: '#5f8f4f' }
];
const CHAR_PALETTE = ['#c0654f', '#4f7a6b', '#7a5a8f', '#a68a3f', '#4f6f8f', '#8f4f6b', '#5f8f4f', '#3f8f8a'];

const appState = {
  // legacy top-level shape (kept for initial compatibility).
  entities: { characters: [], places: [], objects: [], lore: [] },
  chapters: [],
  acts: [],
  openCats: { characters: true, places: false, objects: false, lore: false },
  sidebarCollapsed: false,
  // New data-model: will be populated/migrated on load. Keep empty defaults so save/load code remains stable.
  series: undefined,
  currentSeriesId: undefined
};

const STORAGE_KEY = 'novel-planner-state-v1';
const IMG_PREFIX = 'img:';

const appApi = {
  CATS,
  state: appState,
  images: {},
  charColor(id) {
    const index = this.state.entities.characters.findIndex((character) => character.id === id);
    return CHAR_PALETTE[index % CHAR_PALETTE.length] || '#7d8a99';
  },
  uid() {
    return 'id' + Math.random().toString(36).slice(2, 10);
  },
  currentSeries() {
    const sId = this.state.currentSeriesId;
    if (this.state.series && Array.isArray(this.state.series)) {
      return this.state.series.find((s) => s.id === sId) || this.state.series[0] || null;
    }
    return null;
  },
  currentBook() {
    const series = this.currentSeries();
    if (!series) return null;
    const bId = series.currentBookId;
    return (series.books && series.books.find((b) => b.id === bId)) || (series.books && series.books[0]) || null;
  },
  syncAliases() {
    const series = this.currentSeries();
    const book = this.currentBook();
    if (series && book) {
      this.state.entities = series.world && series.world.codex ? series.world.codex.entities : this.state.entities;
      this.state.chapters = book.chapters || this.state.chapters;
      this.state.acts = book.acts || this.state.acts;
      this.state.openCats = (series.world && series.world.ui && series.world.ui.openCats) || this.state.openCats;
      this.state.sidebarCollapsed = (series.world && series.world.ui && series.world.ui.sidebarCollapsed) || this.state.sidebarCollapsed;
    }
  },
  async setCurrentSeries(seriesId) {
    if (!seriesId) return;
    this.state.currentSeriesId = seriesId;
    // ensure currentBookId is valid
    const series = this.currentSeries();
    if (series && (!series.currentBookId || !series.books.find((b) => b.id === series.currentBookId))) {
      series.currentBookId = series.books && series.books[0] ? series.books[0].id : null;
    }
    this.syncAliases();
    await this.saveState();
    this.render();
  },
  async setCurrentBook(bookId) {
    const series = this.currentSeries();
    if (!series) return;
    if (!bookId) return;
    series.currentBookId = bookId;
    this.syncAliases();
    await this.saveState();
    this.render();
  },
  async addBook(name) {
    const series = this.currentSeries();
    if (!series) return null;
    const bookId = this.uid();
    const book = { id: bookId, name: name || 'Untitled Book', chapters: [], acts: [], ui: {} };
    series.books = series.books || [];
    series.books.push(book);
    series.currentBookId = bookId;
    // keep codex shared by reference (no copy)
    this.syncAliases();
    await this.saveState();
    this.render();
    return book;
  },
  async addSeries(name) {
    const seriesId = this.uid();
    const bookId = this.uid();
    const series = {
      id: seriesId,
      name: name || 'Untitled Series',
      world: {
        codex: { entities: { characters: [], places: [], objects: [], lore: [] } },
        ui: { openCats: { characters: true, places: false, objects: false, lore: false }, sidebarCollapsed: false }
      },
      books: [ { id: bookId, name: 'Book 1', chapters: [], acts: [] } ],
      currentBookId: bookId
    };
    this.state.series = this.state.series || [];
    this.state.series.push(series);
    this.state.currentSeriesId = seriesId;
    this.syncAliases();
    await this.saveState();
    this.render();
    return series;
  },
  async loadState() {
    const saved = await loadStoredValue(STORAGE_KEY);

    // Helper to create the new Series/Book wrapper from legacy pieces
    const makeSeriesFromLegacy = (legacy) => {
      const seriesId = this.uid();
      const bookId = this.uid();
      const entities = legacy.entities || { characters: [], places: [], objects: [], lore: [] };
      const chapters = legacy.chapters || [];
      const acts = legacy.acts || [];
      const openCats = legacy.openCats || { characters: true, places: false, objects: false, lore: false };
      const sidebarCollapsed = legacy.sidebarCollapsed || false;

      const series = {
        id: seriesId,
        name: 'Resonance',
        world: {
          codex: { entities },
          ui: { openCats, sidebarCollapsed }
        },
        books: [
          { id: bookId, name: 'Dissonance', chapters, acts }
        ],
        currentBookId: bookId
      };
      return { series: [series], currentSeriesId: seriesId };
    };

    if (saved) {
      // Detect new-style saved state
      if (saved.series && Array.isArray(saved.series)) {
        // saved already in new shape: use it, but keep legacy aliases for compatibility
        Object.assign(this.state, saved);
      } else {
        // Legacy shape: migrate into new series/book wrapper
        const wrapped = makeSeriesFromLegacy(saved);
        Object.assign(this.state, wrapped);
      }
    } else {
      // No saved data: create a default Series/Book using existing appState
      const wrapped = makeSeriesFromLegacy(this.state);
      Object.assign(this.state, wrapped);
    }

    // Ensure legacy convenience properties mirror the current series/book for compatibility.
    const syncAliases = () => {
      const series = this.currentSeries();
      const book = this.currentBook();
      if (series && book) {
        // point top-level convenience keys at nested data (initially reference same objects)
        this.state.entities = series.world.codex.entities;
        this.state.chapters = book.chapters;
        this.state.acts = book.acts;
        this.state.openCats = series.world.ui.openCats;
        this.state.sidebarCollapsed = series.world.ui.sidebarCollapsed;
      }
    };

    syncAliases();

    const storedImages = await loadStoredImages(IMG_PREFIX);
    this.images = storedImages;
    this.render();
  },
  async saveState() {
    // Before saving, ensure top-level convenience props are copied into the nested series/book
    try {
      const series = this.currentSeries();
      const book = this.currentBook();
      if (series && book) {
        // push any top-level mutations into the nested authoritative structure
        series.world = series.world || { codex: { entities: { characters: [], places: [], objects: [], lore: [] } }, ui: { openCats: {}, sidebarCollapsed: false } };
        series.world.codex.entities = this.state.entities || series.world.codex.entities;
        series.world.ui = series.world.ui || { openCats: {}, sidebarCollapsed: false };
        series.world.ui.openCats = this.state.openCats || series.world.ui.openCats;
        series.world.ui.sidebarCollapsed = this.state.sidebarCollapsed || series.world.ui.sidebarCollapsed;

        book.chapters = this.state.chapters || book.chapters;
        book.acts = this.state.acts || book.acts;
      }
    } catch (e) {
      console.error('State sync before save failed', e);
    }
    await saveStoredValue(STORAGE_KEY, this.state);
  },
  async setItemImage(itemId, dataUrl) {
    this.images[itemId] = dataUrl;
    try {
      await window.storage.set(IMG_PREFIX + itemId, dataUrl, false);
    } catch (error) {
      console.error('Image save failed', error);
      alert('That image could not be saved — try a smaller photo.');
    }
  },
  async deleteItemImage(itemId) {
    if (!this.images[itemId]) return;
    delete this.images[itemId];
    try {
      await window.storage.delete(IMG_PREFIX + itemId, false);
    } catch (_error) {
      // already gone
    }
  },
  render() {
    document.getElementById('sidebar').classList.toggle('collapsed', this.state.sidebarCollapsed);
    document.getElementById('sidebar-toggle').innerHTML = this.state.sidebarCollapsed ? '&#8677;' : '&#8676;';
    renderSidebar();
    renderTimeline();
  },
  renderSidebar() {
    renderSidebar();
  },
  renderTimeline() {
    renderTimeline();
  },
  openItemModal(categoryKey, itemId) {
    openItemModal(categoryKey, itemId);
  },
  openChapterModal(chapterId) {
    openChapterModal(chapterId);
  }
};

window.app = appApi;

async function boot() {
  initBooksModule();
  initTimelineModule();
  await appApi.loadState();
}

boot();
