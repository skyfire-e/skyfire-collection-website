// Shared mouse drag & drop for reorderable grids (category buttons on
// section/group pages, item cards in galleries) plus a click-to-swap arrow
// controller that works identically on desktop and mobile.
//
// Touch-based freeform drag was removed — the 2D nearest-neighbor hit-test
// was fundamentally broken on multi-column mobile grids (diagonal swaps,
// ambiguous insert direction). On mobile, reordering is done via the arrow
// buttons provided by createSwapArrows(); desktop retains mouse drag.

export function createReorderDnd(container, itemSelector) {
  let dragSrc = null;

  function onDragStart(e) {
    dragSrc = this;
    this.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== dragSrc && dragSrc) {
      const children = [...container.children];
      const srcIdx = children.indexOf(dragSrc);
      const tgtIdx = children.indexOf(this);
      if (srcIdx < tgtIdx) container.insertBefore(dragSrc, this.nextSibling);
      else container.insertBefore(dragSrc, this);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDragEnd() {
    this.style.opacity = '';
    dragSrc = null;
    container.querySelectorAll(itemSelector).forEach((el) => {
      el.style.opacity = '';
    });
  }

  return {
    // (Re)binds to the container's current children — call again after a re-render
    enable() {
      container.querySelectorAll(itemSelector).forEach((el) => {
        el.draggable = true;
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('drop', onDrop);
        el.addEventListener('dragend', onDragEnd);
      });
    },
    disable() {
      container.querySelectorAll(itemSelector).forEach((el) => {
        el.draggable = false;
        el.removeEventListener('dragstart', onDragStart);
        el.removeEventListener('dragover', onDragOver);
        el.removeEventListener('drop', onDrop);
        el.removeEventListener('dragend', onDragEnd);
      });
    }
  };
}

export function createSwapArrows(container, itemSelector) {
  const overlayClass = 'swap-hint';

  function ensureArrows(el) {
    let overlay = el.querySelector('.' + overlayClass);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = overlayClass;

      const leftBtn = document.createElement('button');
      leftBtn.type = 'button';
      leftBtn.className = 'swap-arrow swap-left';
      leftBtn.setAttribute('aria-label', 'Move up');
      leftBtn.innerHTML = '\u2190';

      const rightBtn = document.createElement('button');
      rightBtn.type = 'button';
      rightBtn.className = 'swap-arrow swap-right';
      rightBtn.setAttribute('aria-label', 'Move down');
      rightBtn.innerHTML = '\u2192';

      overlay.appendChild(leftBtn);
      overlay.appendChild(rightBtn);

      leftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prev = el.previousElementSibling;
        if (prev && prev.matches(itemSelector)) {
          container.insertBefore(el, prev);
        }
      });

      rightBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = el.nextElementSibling;
        if (next && next.matches(itemSelector)) {
          container.insertBefore(next, el);
        }
      });

      el.appendChild(overlay);
    }
    return overlay;
  }

  return {
    enable() {
      container.querySelectorAll(itemSelector).forEach((el) => {
        el.classList.add('reorder-swap');
        ensureArrows(el).classList.remove('hidden');
      });
    },
    disable() {
      container.querySelectorAll(itemSelector).forEach((el) => {
        el.classList.remove('reorder-swap');
        const overlay = el.querySelector('.' + overlayClass);
        if (overlay) overlay.classList.add('hidden');
      });
    }
  };
}
