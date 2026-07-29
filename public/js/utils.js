export function thumbUrl(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return imgPath;
  const name = imgPath.split('/').pop().replace(/\.[^.]+$/, '.jpg');
  return '/uploads/thumb-' + name;
}

export function createFocusTrap(container) {
  const focusable = container.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return null;
  return function(e) {
    if (e.key !== 'Tab') return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
}

export async function withPending(button, operation) {
  const prev = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving\u2026';
  try {
    return await operation();
  } finally {
    button.disabled = false;
    button.textContent = prev;
  }
}

// Stop <input type="number"> from changing its value on mouse wheel while focused.
// The wheel event is only swallowed when the input actually has focus, so scrolling
// the page with the cursor merely hovering over the field keeps working.
export function disableWheelOnNumberInputs(root = document) {
  root.querySelectorAll('input[type="number"]').forEach(input => {
    if (input.dataset.wheelGuard) return;
    input.dataset.wheelGuard = '1';
    input.addEventListener('wheel', function (e) {
      if (document.activeElement === this) e.preventDefault();
    }, { passive: false });
  });
}
