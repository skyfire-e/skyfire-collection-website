// Shared drag & drop + touch reorder for reorderable grids: category buttons on
// section/group pages (.category-btn) and item cards in galleries (.gallery-card).
// Extracted from section-pages.js and gallery-page.js, which carried ~90 nearly
// identical lines each (M4). The unified onDragOver also guards against a null
// drag source — the old gallery version threw a DOMException when an external
// file was dragged over a card in reorder mode.

export function createReorderDnd(container, itemSelector) {
  let dragSrc = null;
  let touchReorder = null;

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
    container.querySelectorAll(itemSelector).forEach(el => { el.style.opacity = ''; });
  }

  function onTouchStart(e) {
    const touch = e.touches[0];
    touchReorder = { el: this, startX: touch.clientX, startY: touch.clientY };
  }

  function onTouchMove(e) {
    if (!touchReorder || touchReorder.el !== this) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchReorder.startX;
    const dy = touch.clientY - touchReorder.startY;
    if (Math.hypot(dx, dy) > 15) {
      e.preventDefault();
      // Nearest-neighbor hit-test in BOTH axes: galleries are multi-column
      // grids, so the old clientY-only comparison made horizontal moves
      // within a row impossible (the drop target was always mis-computed).
      const children = [...container.querySelectorAll(itemSelector)];
      let target = null;
      let best = Infinity;
      for (const child of children) {
        if (child === this) continue;
        const r = child.getBoundingClientRect();
        const d = Math.hypot(touch.clientX - (r.left + r.width / 2), touch.clientY - (r.top + r.height / 2));
        if (d < best) { best = d; target = child; }
      }
      if (target) {
        // Move toward the nearest card: forward → insert after it, back → before it
        if (this.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) {
          container.insertBefore(this, target.nextSibling);
        } else {
          container.insertBefore(this, target);
        }
      }
      touchReorder.startX = touch.clientX;
      touchReorder.startY = touch.clientY;
    }
  }

  function onTouchEnd() {
    touchReorder = null;
  }

  return {
    // (Re)binds to the container's current children — call again after a re-render
    enable() {
      container.querySelectorAll(itemSelector).forEach(el => {
        el.draggable = true;
        el.addEventListener('dragstart', onDragStart);
        el.addEventListener('dragover', onDragOver);
        el.addEventListener('drop', onDrop);
        el.addEventListener('dragend', onDragEnd);
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        // System gesture interruptions (notifications, app switch) fire
        // touchcancel, not touchend — without this the drag state "sticks"
        el.addEventListener('touchcancel', onTouchEnd, { passive: true });
      });
    },
    disable() {
      container.querySelectorAll(itemSelector).forEach(el => {
        el.draggable = false;
        el.removeEventListener('dragstart', onDragStart);
        el.removeEventListener('dragover', onDragOver);
        el.removeEventListener('drop', onDrop);
        el.removeEventListener('dragend', onDragEnd);
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        el.removeEventListener('touchcancel', onTouchEnd);
      });
    }
  };
}
