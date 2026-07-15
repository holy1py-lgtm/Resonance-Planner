export function initAllExpandingTextareas(root = document) {
  root.querySelectorAll('.exp-toggle').forEach((btn) => {
    const target = btn.dataset.target;
    if (!target) return;
    const ta = root.querySelector(`#${target}`);
    if (!ta) return;
    attachExpandingTextarea(ta, btn);
  });
}

function attachExpandingTextarea(textarea, toggleBtn) {
  const modal = textarea.closest('.modal') || document.body;
  const COLLAPSED_MAX = 240; // px
  const EXPANDED_MAX_RATIO = 0.78; // of viewport height

  function computeExpandedMax() {
    return Math.round(window.innerHeight * EXPANDED_MAX_RATIO);
  }

  function resizeOnce() {
    // autoresize while respecting sensible max heights
    textarea.style.height = 'auto';
    const desired = textarea.scrollHeight;
    const max = modal.classList.contains('exp-text-expanded') ? computeExpandedMax() : COLLAPSED_MAX;
    const height = Math.min(desired, max);
    textarea.style.height = height + 'px';
    textarea.style.overflowY = desired > max ? 'auto' : 'hidden';
  }

  // style class
  textarea.classList.add('exp-textarea');

  // input listener
  textarea.addEventListener('input', () => resizeOnce());

  // toggle button behavior
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const expanded = modal.classList.toggle('exp-text-expanded');
    toggleBtn.dataset.expanded = expanded ? 'true' : 'false';
    toggleBtn.title = expanded ? 'Collapse' : 'Expand';
    toggleBtn.textContent = expanded ? '\u291F' : '\u21E1';
    // also add a helper class for CSS sizing
    if (expanded) modal.classList.add('expanded-textarea'); else modal.classList.remove('expanded-textarea');
    // after toggling, recompute size
    resizeOnce();
    // focus textarea for convenience
    textarea.focus();
  });

  // ensure initial size after insertion
  setTimeout(resizeOnce, 0);
  // keep responsive on viewport changes
  window.addEventListener('resize', resizeOnce);
}
