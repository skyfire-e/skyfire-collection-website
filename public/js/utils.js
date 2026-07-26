export function thumbUrl(imgPath) {
  if (!imgPath || !imgPath.startsWith('/uploads/')) return imgPath;
  const name = imgPath.split('/').pop().replace(/\.[^.]+$/, '.jpg');
  return '/uploads/thumb-' + name;
}

export function createFocusTrap(container) {
  const focusable = container.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
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
