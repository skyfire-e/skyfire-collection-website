// Cooperative touch input: one finger stays entirely native; two fingers that
// start on the scene before scrolling claim rotation/pinch for this gesture.
// Changing touch-action after pointerdown cannot reclaim a browser scroll.
export function attachTouchControls(surface, { onStart, onMove }) {
  let phase = 'idle';
  let previous = null;
  const options = { capture: true, passive: false };
  const sample = (touches) => {
    const [a, b] = touches;
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    };
  };
  function claim(event) {
    if (!event.cancelable) return false;
    event.preventDefault();
    return event.defaultPrevented;
  }
  function start(event) {
    // A new contact must never steal a one-finger scroll already in progress.
    if (phase === 'native') return;
    // Simultaneous contacts on different descendants can produce one
    // touchstart per target with the same two-contact list.
    if (phase === 'orbit' && event.touches.length === 2) {
      claim(event);
      return;
    }
    if (phase === 'ending' || phase === 'orbit') {
      claim(event);
      phase = 'ending';
      return;
    }
    const touches = Array.from(event.touches);
    if (touches.length === 2 && touches.every((touch) => surface.contains(touch.target)) && claim(event)) {
      previous = sample(touches);
      phase = 'orbit';
      onStart();
    } else {
      phase = touches.length === 1 ? 'pending' : 'native';
    }
  }
  function move(event) {
    if (phase === 'ending') {
      claim(event);
      return;
    }
    if (phase !== 'orbit') {
      phase = 'native';
      return;
    }
    if (event.touches.length !== 2 || !claim(event)) {
      phase = 'native';
      previous = null;
      return;
    }
    const next = sample(event.touches);
    onMove({
      deltaX: next.x - previous.x,
      deltaY: next.y - previous.y,
      scale: previous.distance > 0 && next.distance > 0 ? previous.distance / next.distance : 1
    });
    previous = next;
  }
  function end(event) {
    if (phase === 'orbit' || phase === 'ending') {
      // Lifting one finger must not turn a rotation into a scroll or hotspot tap.
      claim(event);
      phase = 'ending';
    }
    previous = null;
    if (event.touches.length === 0) phase = 'idle';
  }
  function blockOrbitTouch(event) {
    // OrbitControls handles mouse/pen only. Native touch defaults are preserved.
    if (event.pointerType === 'touch') event.stopPropagation();
  }
  surface.addEventListener('pointerdown', blockOrbitTouch, true);
  surface.addEventListener('touchstart', start, options);
  surface.addEventListener('touchmove', move, options);
  surface.addEventListener('touchend', end, options);
  surface.addEventListener('touchcancel', end, options);
  return () => {
    surface.removeEventListener('pointerdown', blockOrbitTouch, true);
    surface.removeEventListener('touchstart', start, options);
    surface.removeEventListener('touchmove', move, options);
    surface.removeEventListener('touchend', end, options);
    surface.removeEventListener('touchcancel', end, options);
  };
}
