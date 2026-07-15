import { escapeHtml, linkifyText, wireCodexLinks } from './codex.js';
import { initAllExpandingTextareas } from './expandingTextarea.js';

const app = () => window.app;

function resizeImageFile(file, maxDim = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not load image'));
      image.onload = () => {
        let { width, height } = image;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function openLightbox(src) {
  if (!src) return;
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxOverlay').classList.add('show');
}

export function closeLightbox() {
  document.getElementById('lightboxOverlay').classList.remove('show');
}

export function renderSidebar() {
  const currentApp = app();
  const body = document.getElementById('sidebar-body');
  body.innerHTML = '';

  currentApp.CATS.forEach((category) => {
    const items = currentApp.state.entities[category.key];
    const section = document.createElement('div');
    section.className = 'cat-section' + (currentApp.state.openCats[category.key] ? ' open' : '');

    const head = document.createElement('div');
    head.className = 'cat-head';
    head.innerHTML = `
      <span class="cat-dot" style="background:${category.color}"></span>
      <span class="cat-label">${category.label}</span>
      <span class="cat-count">${items.length}</span>
      <span class="cat-chevron">&#9656;</span>
    `;
    head.addEventListener('click', () => {
      currentApp.state.openCats[category.key] = !currentApp.state.openCats[category.key];
      renderSidebar();
    });
    section.appendChild(head);

    const inner = document.createElement('div');
    inner.className = 'cat-inner';

    if (items.length === 0) {
      const note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = `No ${category.label.toLowerCase()} yet.`;
      inner.appendChild(note);
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      const thumbHtml = currentApp.images[item.id]
        ? `<img class="item-thumb" src="${currentApp.images[item.id]}" title="Click to view full size">`
        : `<div class="item-thumb-placeholder" style="background:${category.color}">${escapeHtml((item.name || '?').charAt(0).toUpperCase())}</div>`;
      card.innerHTML = `
        <button class="item-del" title="Delete">&times;</button>
        ${thumbHtml}
        <div class="item-text-col">
          <div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-desc">${linkifyText(item.desc || '', item.id)}</div>
        </div>
      `;
      wireCodexLinks(card);
      const thumbElement = card.querySelector('.item-thumb');
      if (thumbElement) {
        thumbElement.addEventListener('click', (event) => {
          event.stopPropagation();
          openLightbox(currentApp.images[item.id]);
        });
      }
      card.querySelector('.item-del').addEventListener('click', (event) => {
        event.stopPropagation();
        if (category.key === 'characters') {
          currentApp.state.chapters.forEach((chapter) => {
            chapter.characterIds = chapter.characterIds.filter((id) => id !== item.id);
          });
        }
        if (category.key === 'places') {
          currentApp.state.chapters.forEach((chapter) => {
            if (chapter.placeId === item.id) chapter.placeId = null;
          });
        }
        currentApp.state.entities[category.key] = currentApp.state.entities[category.key].filter((entry) => entry.id !== item.id);
        currentApp.deleteItemImage(item.id);
        currentApp.saveState();
        renderSidebar();
        currentApp.renderTimeline();
      });
      card.addEventListener('click', () => openItemModal(category.key, item.id));
      inner.appendChild(card);
    });

    const addButton = document.createElement('button');
    addButton.className = 'add-btn';
    addButton.textContent = '+ Add ' + category.label.slice(0, -1);
    addButton.addEventListener('click', () => openItemModal(category.key, null));
    inner.appendChild(addButton);

    section.appendChild(inner);
    body.appendChild(section);
  });
}

export function openItemModal(categoryKey, itemId) {
  const currentApp = app();
  const categoryMeta = currentApp.CATS.find((category) => category.key === categoryKey);
  const isNew = !itemId;
  const item = isNew ? { id: currentApp.uid(), name: '', desc: '' } : currentApp.state.entities[categoryKey].find((entry) => entry.id === itemId);

  let pendingImage = currentApp.images[item.id] || null;
  let imageRemoved = false;

  const modal = document.getElementById('itemModal');
  modal.innerHTML = `
    <h3>${isNew ? 'New ' + categoryMeta.label.slice(0, -1) : 'Edit ' + categoryMeta.label.slice(0, -1)}</h3>
    <div class="field">
      <label>Picture</label>
      <div class="image-field" id="im-image-field"></div>
    </div>
    <div class="field">
      <label>Name</label>
      <input type="text" id="im-name" value="${escapeHtml(item.name)}" placeholder="Name...">
    </div>
    <div class="field">
      <label>Description <button type="button" class="exp-toggle" data-target="im-desc" title="Expand">⤡</button></label>
      <div class="exp-wrap" data-target="im-desc-wrap">
        <textarea id="im-desc" placeholder="Notes, backstory, traits...">${escapeHtml(item.desc || '')}</textarea>
      </div>
    </div>
    <div class="modal-actions">
      <div>${isNew ? '' : '<button class="btn btn-danger" id="im-delete">Delete</button>'}</div>
      <div>
        <button class="btn btn-secondary" id="im-cancel">Cancel</button>
        <button class="btn btn-primary" id="im-save">Save</button>
      </div>
    </div>
  `;

  const renderImageField = () => {
    const field = document.getElementById('im-image-field');
    field.innerHTML = `
      ${pendingImage
        ? `<img class="image-preview" id="im-image-preview" src="${pendingImage}" title="Click to view full size">`
        : '<div class="image-preview-placeholder">No photo</div>'}
      <div class="image-btns">
        <label for="im-image-input">${pendingImage ? 'Replace' : 'Upload'}</label>
        <input type="file" id="im-image-input" accept="image/*" style="display:none;">
        ${pendingImage ? '<button type="button" class="remove-img-btn" id="im-image-remove">Remove</button>' : ''}
      </div>
    `;
    const preview = document.getElementById('im-image-preview');
    if (preview) preview.addEventListener('click', () => openLightbox(pendingImage));
    document.getElementById('im-image-input').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        pendingImage = await resizeImageFile(file);
        imageRemoved = false;
        renderImageField();
      } catch (_error) {
        alert('Could not load that image — try a different file.');
      }
    });
    const removeButton = document.getElementById('im-image-remove');
    if (removeButton) {
      removeButton.addEventListener('click', () => {
        pendingImage = null;
        imageRemoved = true;
        renderImageField();
      });
    }
  };

  renderImageField();
  document.getElementById('itemOverlay').classList.add('show');
  // initialize expanding textarea behavior and focus
  initAllExpandingTextareas(modal);
  document.getElementById('im-name').focus();

  document.getElementById('im-cancel').addEventListener('click', closeItemModal);
  document.getElementById('itemOverlay').addEventListener('click', (event) => {
    if (event.target.id === 'itemOverlay') closeItemModal();
  });

  if (!isNew) {
    document.getElementById('im-delete').addEventListener('click', async () => {
      if (categoryKey === 'characters') {
        currentApp.state.chapters.forEach((chapter) => {
          chapter.characterIds = chapter.characterIds.filter((id) => id !== item.id);
        });
      }
      if (categoryKey === 'places') {
        currentApp.state.chapters.forEach((chapter) => {
          if (chapter.placeId === item.id) chapter.placeId = null;
        });
      }
      currentApp.state.entities[categoryKey] = currentApp.state.entities[categoryKey].filter((entry) => entry.id !== item.id);
      await currentApp.deleteItemImage(item.id);
      currentApp.saveState();
      closeItemModal();
      renderSidebar();
      currentApp.renderTimeline();
    });
  }

  document.getElementById('im-save').addEventListener('click', async () => {
    const name = document.getElementById('im-name').value.trim();
    const desc = document.getElementById('im-desc').value.trim();
    if (!name) return;
    if (isNew) {
      currentApp.state.entities[categoryKey].push({ id: item.id, name, desc });
    } else {
      item.name = name;
      item.desc = desc;
    }
    if (pendingImage && pendingImage !== currentApp.images[item.id]) {
      await currentApp.setItemImage(item.id, pendingImage);
    } else if (imageRemoved) {
      await currentApp.deleteItemImage(item.id);
    }
    currentApp.saveState();
    closeItemModal();
    renderSidebar();
    currentApp.renderTimeline();
  });
}

export function closeItemModal() {
  document.getElementById('itemOverlay').classList.remove('show');
}

export function exportData() {
  const currentApp = app();
  const bundle = {
    type: 'novel-planner-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: currentApp.state,
    images: currentApp.images
  };
  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `novel-planner-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importData(file) {
  const currentApp = app();
  let bundle;
  try {
    const text = await file.text();
    bundle = JSON.parse(text);
  } catch (_error) {
    alert('That file could not be read — make sure it\'s a Novel Planner export.');
    return;
  }
  if (!bundle || bundle.type !== 'novel-planner-export' || !bundle.state) {
    alert('That doesn\'t look like a Novel Planner export file.');
    return;
  }
  const replace = confirm(
    'Import this file?\n\nOK = replace everything currently in this planner with the imported data.\nCancel = do nothing.'
  );
  if (!replace) return;

  currentApp.state = Object.assign(
    {
      entities: { characters: [], places: [], objects: [], lore: [] },
      chapters: [],
      acts: [],
      openCats: { characters: true, places: false, objects: false, lore: false },
      sidebarCollapsed: false
    },
    bundle.state
  );
  currentApp.images = bundle.images || {};

  await currentApp.saveState();
  try {
    await Promise.all(Object.keys(currentApp.images).map((id) => currentApp.setItemImage(id, currentApp.images[id])));
  } catch (error) {
    console.error('Some images failed to save during import', error);
  }
  currentApp.render();
  alert('Import complete.');
}

export function toggleSidebar() {
  const currentApp = app();
  currentApp.state.sidebarCollapsed = !currentApp.state.sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', currentApp.state.sidebarCollapsed);
  document.getElementById('sidebar-toggle').innerHTML = currentApp.state.sidebarCollapsed ? '&#8677;' : '&#8676;';
  currentApp.saveState();
}

export function initBooksModule() {
  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightboxOverlay').addEventListener('click', (event) => {
    if (event.target.id === 'lightboxOverlay') closeLightbox();
  });
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importData(file);
    event.target.value = '';
  });
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
}
