import { escapeHtml, linkifyText, wireCodexLinks } from './codex.js';
import { initAllExpandingTextareas } from './expandingTextarea.js';

const app = () => window.app;

function buildChapterNode(chapter) {
  const currentApp = app();
  const node = document.createElement('div');
  node.className = 'chapter-node';
  node.draggable = true;
  node.dataset.id = chapter.id;

  const dot = document.createElement('div');
  dot.className = 'waystation-dot';
  node.appendChild(dot);

  const card = document.createElement('div');
  card.className = 'chapter-card' + (chapter.minimized ? ' minimized' : '');

  const place = chapter.placeId ? currentApp.state.entities.places.find((entry) => entry.id === chapter.placeId) : null;
  const chapterNum = currentApp.state.chapters.indexOf(chapter) + 1;

  let chipsHtml = '';
  let dotsHtml = '';
  (chapter.characterIds || []).forEach((characterId) => {
    const character = currentApp.state.entities.characters.find((entry) => entry.id === characterId);
    if (!character) return;
    const avatar = currentApp.images[characterId] ? `<img class="chip-avatar" src="${currentApp.images[characterId]}">` : '';
    chipsHtml += `<span class="char-chip ${avatar ? '' : 'no-avatar'}" style="background:${currentApp.charColor(characterId)}">${avatar}${escapeHtml(character.name)}</span>`;
    dotsHtml += `<span class="mini-dot" style="background:${currentApp.charColor(characterId)}" title="${escapeHtml(character.name)}"></span>`;
  });

  card.innerHTML = `
    <button class="minimize-toggle" title="${chapter.minimized ? 'Expand' : 'Minimize'}">${chapter.minimized ? '&#9660;' : '&#9650;'}</button>
    <div class="chapter-num">CHAPTER ${chapterNum}</div>
    <div class="chapter-title">${escapeHtml(chapter.title || 'Untitled')}</div>
    <div class="chapter-summary">${linkifyText(chapter.summary || '')}</div>
    ${place ? `<div class="chapter-place">${currentApp.images[place.id] ? `<img class="chip-avatar" src="${currentApp.images[place.id]}" style="border-radius:4px;">` : '&#128205;'} <span>${escapeHtml(place.name)}</span></div>` : ''}
    <div class="chip-row">${chipsHtml}</div>
    <div class="mini-dots">${dotsHtml}</div>
  `;
  wireCodexLinks(card);
  card.querySelector('.minimize-toggle').addEventListener('click', (event) => {
    event.stopPropagation();
    chapter.minimized = !chapter.minimized;
    currentApp.saveState();
    renderTimeline();
  });
  card.addEventListener('click', () => openChapterModal(chapter.id));
  node.appendChild(card);

  node.addEventListener('dragstart', (event) => {
    card.classList.add('dragging');
    event.dataTransfer.setData('text/plain', chapter.id);
  });
  node.addEventListener('dragend', () => card.classList.remove('dragging'));
  node.addEventListener('dragover', (event) => {
    event.preventDefault();
    card.classList.add('drag-over');
  });
  node.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  node.addEventListener('drop', (event) => {
    event.preventDefault();
    card.classList.remove('drag-over');
    const draggedId = event.dataTransfer.getData('text/plain');
    if (draggedId === chapter.id) return;
    const fromIndex = currentApp.state.chapters.findIndex((entry) => entry.id === draggedId);
    const toIndex = currentApp.state.chapters.findIndex((entry) => entry.id === chapter.id);
    const [moved] = currentApp.state.chapters.splice(fromIndex, 1);
    currentApp.state.chapters.splice(toIndex, 0, moved);
    moved.actId = chapter.actId || null;
    currentApp.saveState();
    renderTimeline();
  });

  return node;
}

function buildChapterGroup(chapters) {
  const wrap = document.createElement('div');
  wrap.className = 'chapter-group';

  const nodeWidth = 230;
  const gap = 26;
  const lineWidth = Math.max(chapters.length * (nodeWidth + gap) - gap, 0);
  if (lineWidth > 0) {
    const gradientId = 'canalGrad-' + app().uid();
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('class', 'canal-svg');
    svg.setAttribute('width', lineWidth);
    svg.setAttribute('height', '6');
    svg.innerHTML = `<rect x="0" y="0" width="${lineWidth}" height="6" rx="3" fill="url(#${gradientId})"/>
      <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#4f6f8f"/><stop offset="100%" stop-color="#b8863b"/>
      </linearGradient></defs>`;
    wrap.appendChild(svg);
  }

  chapters.forEach((chapter) => wrap.appendChild(buildChapterNode(chapter)));
  return wrap;
}

function buildActDivider(act) {
  const div = document.createElement('div');
  div.className = 'act-divider';

  if (act) {
    div.innerHTML = `
      <div class="act-controls">
        <button class="act-rename" title="Rename act">&#9998;</button>
        <button class="act-delete" title="Delete act">&times;</button>
      </div>
      <div class="act-label">${escapeHtml(act.name)}</div>
      <div class="act-bar"></div>
    `;
    div.querySelector('.act-rename').addEventListener('click', () => {
      const name = prompt('Rename act:', act.name);
      if (name && name.trim()) {
        act.name = name.trim();
        app().saveState();
        renderTimeline();
      }
    });
    div.querySelector('.act-delete').addEventListener('click', () => {
      if (!confirm(`Delete "${act.name}"? Its chapters will become unassigned, not deleted.`)) return;
      app().state.chapters.forEach((chapter) => {
        if (chapter.actId === act.id) chapter.actId = null;
      });
      app().state.acts = app().state.acts.filter((entry) => entry.id !== act.id);
      app().saveState();
      renderTimeline();
    });
  } else {
    div.innerHTML = `
      <div class="act-controls"></div>
      <div class="act-label" style="color:var(--steel); opacity:.85;">Unassigned</div>
      <div class="act-bar" style="background:var(--steel); opacity:.25;"></div>
    `;
  }
  return div;
}

export function renderTimeline() {
   const appInstance = app();
   const label = document.getElementById('timeline-book-label');
   if (label) {
     const currentBook = appInstance.currentBook ? appInstance.currentBook() : null;
     label.textContent = `Book: ${currentBook ? currentBook.name : 'Dissonance'}`;
   }
   const track = document.getElementById('timeline-track');
   track.innerHTML = '';

   const chapters = appInstance.state.chapters;
   const acts = appInstance.state.acts || [];
  if (acts.length === 0) {
    track.appendChild(buildChapterGroup(chapters));
  } else {
    acts.forEach((act) => {
      const groupChapters = chapters.filter((chapter) => chapter.actId === act.id);
      track.appendChild(buildActDivider(act));
      track.appendChild(buildChapterGroup(groupChapters));
    });
    const actIds = new Set(acts.map((act) => act.id));
    const unassigned = chapters.filter((chapter) => !chapter.actId || !actIds.has(chapter.actId));
    if (unassigned.length) {
      track.appendChild(buildActDivider(null));
      track.appendChild(buildChapterGroup(unassigned));
    }
  }

  const addButton = document.createElement('button');
  addButton.className = 'add-chapter-btn';
  addButton.textContent = '+ Add Chapter';
  addButton.addEventListener('click', () => openChapterModal(null));
  track.appendChild(addButton);
}

export function openChapterModal(chapterId) {
  const currentApp = app();
  const isNew = !chapterId;
  const chapter = isNew
    ? { id: currentApp.uid(), title: '', summary: '', placeId: null, characterIds: [], minimized: false, actId: null }
    : currentApp.state.chapters.find((entry) => entry.id === chapterId);

  const placeOptions = currentApp.state.entities.places.map((place) =>
    `<option value="${place.id}" ${chapter.placeId === place.id ? 'selected' : ''}>${escapeHtml(place.name)}</option>`
  ).join('');

  const actOptions = (currentApp.state.acts || []).map((act) =>
    `<option value="${act.id}" ${chapter.actId === act.id ? 'selected' : ''}>${escapeHtml(act.name)}</option>`
  ).join('');

  const charToggles = currentApp.state.entities.characters.map((character) => {
    const on = (chapter.characterIds || []).includes(character.id);
    const avatar = currentApp.images[character.id] ? `<img class="toggle-avatar" src="${currentApp.images[character.id]}">` : '';
    return `<span class="char-toggle ${on ? 'on' : ''} ${avatar ? '' : 'no-avatar'}" data-id="${character.id}" style="background:${currentApp.charColor(character.id)}">${avatar}${escapeHtml(character.name)}</span>`;
  }).join('');

  const modal = document.getElementById('chapterModal');
  modal.innerHTML = `
    <h3>${isNew ? 'New Chapter' : 'Edit Chapter'}</h3>
    <div class="field">
      <label>Title</label>
      <input type="text" id="cm-title" value="${escapeHtml(chapter.title)}" placeholder="Chapter title...">
    </div>
    <div class="field">
      <label>Summary <button type="button" class="exp-toggle" data-target="cm-summary" title="Expand">⤡</button></label>
      <div class="exp-wrap" data-target="cm-summary-wrap">
        <textarea id="cm-summary" placeholder="What happens in this chapter...">${escapeHtml(chapter.summary || '')}</textarea>
      </div>
    </div>
    <div class="field">
      <label>Act</label>
      <select id="cm-act">
        <option value="">Unassigned</option>
        ${actOptions}
      </select>
    </div>
    <div class="field">
      <label>Place</label>
      <select id="cm-place">
        <option value="">None</option>
        ${placeOptions}
      </select>
    </div>
    <div class="field">
      <label>Characters present</label>
      <div class="char-toggle-list" id="cm-chars">
        ${charToggles || '<span class="empty-note">Add characters in the sidebar first.</span>'}
      </div>
    </div>
    <div class="modal-actions">
      <div>${isNew ? '' : '<button class="btn btn-danger" id="cm-delete">Delete</button>'}</div>
      <div>
        <button class="btn btn-secondary" id="cm-cancel">Cancel</button>
        <button class="btn btn-primary" id="cm-save">Save</button>
      </div>
    </div>
  `;

  const selectedChars = new Set(chapter.characterIds || []);
  modal.querySelectorAll('.char-toggle').forEach((element) => {
    element.addEventListener('click', () => {
      const id = element.dataset.id;
      if (selectedChars.has(id)) {
        selectedChars.delete(id);
        element.classList.remove('on');
      } else {
        selectedChars.add(id);
        element.classList.add('on');
      }
    });
  });

  document.getElementById('chapterOverlay').classList.add('show');
  initAllExpandingTextareas(modal);
  document.getElementById('cm-title').focus();

  document.getElementById('cm-cancel').addEventListener('click', closeChapterModal);
  document.getElementById('chapterOverlay').addEventListener('click', (event) => {
    if (event.target.id === 'chapterOverlay') closeChapterModal();
  });
  if (!isNew) {
    document.getElementById('cm-delete').addEventListener('click', () => {
      currentApp.state.chapters = currentApp.state.chapters.filter((entry) => entry.id !== chapter.id);
      currentApp.saveState();
      closeChapterModal();
      renderTimeline();
    });
  }
  document.getElementById('cm-save').addEventListener('click', () => {
    const title = document.getElementById('cm-title').value.trim();
    const summary = document.getElementById('cm-summary').value.trim();
    const placeId = document.getElementById('cm-place').value || null;
    const actId = document.getElementById('cm-act').value || null;
    const characterIds = Array.from(selectedChars);
    if (!title) return;
    if (isNew) {
      currentApp.state.chapters.push({ id: chapter.id, title, summary, placeId, characterIds, minimized: false, actId });
    } else {
      chapter.title = title;
      chapter.summary = summary;
      chapter.placeId = placeId;
      chapter.characterIds = characterIds;
      chapter.actId = actId;
    }
    currentApp.saveState();
    closeChapterModal();
    renderTimeline();
  });
}

export function closeChapterModal() {
  document.getElementById('chapterOverlay').classList.remove('show');
}

export function minimizeAllChapters() {
  const currentApp = app();
  currentApp.state.chapters.forEach((chapter) => {
    chapter.minimized = true;
  });
  currentApp.saveState();
  renderTimeline();
}

export function expandAllChapters() {
  const currentApp = app();
  currentApp.state.chapters.forEach((chapter) => {
    chapter.minimized = false;
  });
  currentApp.saveState();
  renderTimeline();
}

export function addAct() {
  const currentApp = app();
  const name = prompt('Act name:', `Act ${currentApp.state.acts.length + 1}`);
  if (!name || !name.trim()) return;
  currentApp.state.acts.push({ id: currentApp.uid(), name: name.trim() });
  currentApp.saveState();
  renderTimeline();
}

export function initTimelineModule() {
  document.getElementById('add-act-btn').addEventListener('click', addAct);
  document.getElementById('minimize-all-btn').addEventListener('click', minimizeAllChapters);
  document.getElementById('expand-all-btn').addEventListener('click', expandAllChapters);
}
