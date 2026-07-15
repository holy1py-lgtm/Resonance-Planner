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
  entities: { characters: [], places: [], objects: [], lore: [] },
  chapters: [],
  acts: [],
  openCats: { characters: true, places: false, objects: false, lore: false },
  sidebarCollapsed: false
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
  async loadState() {
    const saved = await loadStoredValue(STORAGE_KEY);
    if (saved) {
      Object.assign(this.state, saved);
    }
    const storedImages = await loadStoredImages(IMG_PREFIX);
    this.images = storedImages;
    this.render();
  },
  async saveState() {
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
