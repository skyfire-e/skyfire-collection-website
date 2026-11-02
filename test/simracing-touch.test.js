const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

async function setup() {
  const { attachTouchControls } = await import('../public/js/simracing/touch-controls.js');
  class Surface extends EventTarget {
    contains(target) {
      return target === this || target.parent === this;
    }
  }
  const surface = new Surface();
  const moves = [];
  let starts = 0;
  const dispose = attachTouchControls(surface, {
    onStart: () => starts++,
    onMove: (move) => moves.push(move)
  });
  const touch = (x, y, target = surface) => ({ clientX: x, clientY: y, target });
  const send = (type, touches, cancelable = true) => {
    const event = new Event(type, { cancelable });
    Object.defineProperty(event, 'touches', { value: touches });
    surface.dispatchEvent(event);
    return event;
  };
  return {
    surface,
    moves,
    touch,
    send,
    dispose,
    get starts() {
      return starts;
    }
  };
}

describe('cooperative cockpit touch controls', () => {
  it('leaves single-finger swipes and taps entirely native in every direction', async () => {
    const rig = await setup();
    for (const [x, y] of [
      [50, 0],
      [0, 50],
      [50, 50]
    ]) {
      assert.equal(rig.send('touchstart', [rig.touch(0, 0)]).defaultPrevented, false);
      assert.equal(rig.send('touchmove', [rig.touch(x, y)]).defaultPrevented, false);
      assert.equal(rig.send('touchend', []).defaultPrevented, false);
    }
    assert.equal(rig.send('touchstart', [rig.touch(0, 0)]).defaultPrevented, false);
    assert.equal(rig.send('touchend', []).defaultPrevented, false);
    assert.equal(rig.starts, 0);
    assert.deepEqual(rig.moves, []);
  });

  it('claims a two-finger drag across the canvas and a hotspot and measures pinch', async () => {
    const rig = await setup();
    const hotspot = { parent: rig.surface };
    rig.send('touchstart', [rig.touch(10, 10)]);
    assert.equal(rig.send('touchstart', [rig.touch(10, 10), rig.touch(30, 10, hotspot)]).defaultPrevented, true);
    rig.send('touchstart', [rig.touch(10, 10), rig.touch(30, 10, hotspot)]);
    assert.equal(rig.starts, 1);
    assert.equal(rig.send('touchmove', [rig.touch(20, 30), rig.touch(40, 30, hotspot)]).defaultPrevented, true);
    assert.deepEqual(rig.moves[0], { deltaX: 10, deltaY: 20, scale: 1 });
    rig.send('touchmove', [rig.touch(10, 30), rig.touch(50, 30, hotspot)]);
    assert.deepEqual(rig.moves[1], { deltaX: 0, deltaY: 0, scale: 0.5 });
  });

  it('does not steal scrolling when a second finger arrives after movement', async () => {
    const rig = await setup();
    rig.send('touchstart', [rig.touch(0, 0)]);
    rig.send('touchmove', [rig.touch(0, 30)]);
    assert.equal(rig.send('touchstart', [rig.touch(0, 30), rig.touch(50, 30)]).defaultPrevented, false);
    assert.equal(rig.send('touchmove', [rig.touch(0, 60), rig.touch(50, 60)]).defaultPrevented, false);
    assert.equal(rig.starts, 0);
    assert.deepEqual(rig.moves, []);
  });

  it('stops moving the camera after a finger lifts and allows a fresh scroll after release', async () => {
    const rig = await setup();
    rig.send('touchstart', [rig.touch(0, 0), rig.touch(20, 0)]);
    assert.equal(rig.send('touchend', [rig.touch(0, 0)]).defaultPrevented, true);
    assert.equal(rig.send('touchmove', [rig.touch(0, 50)]).defaultPrevented, true);
    assert.deepEqual(rig.moves, []);
    assert.equal(rig.send('touchend', []).defaultPrevented, true);
    rig.send('touchstart', [rig.touch(0, 0)]);
    assert.equal(rig.send('touchmove', [rig.touch(0, 30)]).defaultPrevented, false);
  });

  it('ignores a non-cancelable browser gesture or a contact outside the scene', async () => {
    const rig = await setup();
    const pair = [rig.touch(0, 0), rig.touch(20, 0)];
    rig.send('touchstart', pair, false);
    rig.send('touchmove', pair, false);
    assert.equal(rig.starts, 0);
    rig.send('touchend', []);
    assert.equal(rig.send('touchstart', [pair[0], rig.touch(20, 0, {})]).defaultPrevented, false);
    assert.equal(rig.starts, 0);
    assert.deepEqual(rig.moves, []);
  });

  it('recovers from cancellation and a third finger without camera jumps', async () => {
    const rig = await setup();
    const pair = [rig.touch(0, 0), rig.touch(20, 0)];
    rig.send('touchstart', pair);
    rig.send('touchcancel', []);
    rig.send('touchstart', pair);
    rig.send('touchstart', [...pair, rig.touch(40, 0)]);
    rig.send('touchend', pair);
    rig.send('touchmove', [rig.touch(50, 0), rig.touch(70, 0)]);
    assert.deepEqual(rig.moves, []);
    rig.send('touchend', []);
    rig.send('touchstart', pair);
    rig.send('touchmove', [rig.touch(10, 0), rig.touch(30, 0)]);
    assert.deepEqual(rig.moves, [{ deltaX: 10, deltaY: 0, scale: 1 }]);
  });

  it('releases its handlers when the WebGL viewer becomes unavailable', async () => {
    const rig = await setup();
    rig.dispose();
    assert.equal(rig.send('touchstart', [rig.touch(0, 0), rig.touch(20, 0)]).defaultPrevented, false);
    assert.equal(rig.starts, 0);
  });
});
