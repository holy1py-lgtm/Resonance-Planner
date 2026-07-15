export function escapeHtml(str) {
  const element = document.createElement('div');
  element.textContent = str;
  return element.innerHTML;
}

export function linkifyText(text, excludeId) {
  const app = window.app;
  if (!text) return '';
  const entries = [
    ...app.state.entities.characters.map((character) => ({
      id: character.id,
      name: (character.name || '').trim(),
      key: 'characters',
      color: app.charColor(character.id)
    })),
    ...app.state.entities.lore.map((entry) => ({
      id: entry.id,
      name: (entry.name || '').trim(),
      key: 'lore',
      color: '#7fb26a'
    }))
  ].filter((entry) => entry.name.length > 1 && entry.id !== excludeId);

  if (entries.length === 0) return escapeHtml(text);

  const candidates = [];
  entries.forEach((entry) => {
    const safeName = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + safeName + '\\b', 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      candidates.push({ start: match.index, end: match.index + match[0].length, entry });
      if (regex.lastIndex === match.index) regex.lastIndex += 1;
    }
  });

  if (candidates.length === 0) return escapeHtml(text);

  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const accepted = [];
  let lastEnd = -1;
  candidates.forEach((candidate) => {
    if (candidate.start >= lastEnd) {
      accepted.push(candidate);
      lastEnd = candidate.end;
    }
  });

  let result = '';
  let position = 0;
  accepted.forEach((candidate) => {
    result += escapeHtml(text.slice(position, candidate.start));
    const matchText = text.slice(candidate.start, candidate.end);
    result += `<span class="codex-link" data-type="${candidate.entry.key}" data-id="${candidate.entry.id}" style="color:${candidate.entry.color}">${escapeHtml(matchText)}</span>`;
    position = candidate.end;
  });
  result += escapeHtml(text.slice(position));
  return result;
}

export function wireCodexLinks(container) {
  container.querySelectorAll('.codex-link').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      const app = window.app;
      app.openItemModal(element.dataset.type, element.dataset.id);
    });
  });
}
