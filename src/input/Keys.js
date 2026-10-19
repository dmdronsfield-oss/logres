// Keyboard play for desktop. Arrow keys strike in their direction; two arrows
// pressed together give a diagonal; the numpad gives all eight directly.
// A / D dodge, S or Space holds the shield, W or Enter fires the super.

const COMBINE_MS = 60;

const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const NUMPAD = {
  Numpad8: 'N', Numpad2: 'S', Numpad4: 'W', Numpad6: 'E',
  Numpad7: 'NW', Numpad9: 'NE', Numpad1: 'SW', Numpad3: 'SE',
};

function dirFrom(x, y) {
  const v = (y < 0 ? 'N' : y > 0 ? 'S' : '') + (x > 0 ? 'E' : x < 0 ? 'W' : '');
  return v || null;
}

// True on devices whose main pointer is a mouse or trackpad.
export function desktopLikely() {
  try {
    return window.matchMedia('(pointer: fine)').matches && !('ontouchstart' in window);
  } catch (e) {
    return false;
  }
}

// handlers: { swipe(dir), dodge(side), block(held), superMove(), pause(), confirm() }
export function bindDuelKeys(scene, h) {
  let pending = null; // { x, y, timer }
  const flush = () => {
    if (!pending) return;
    const d = dirFrom(pending.x, pending.y);
    clearTimeout(pending.timer);
    pending = null;
    if (d) h.swipe(d);
  };
  const blockKeys = new Set();
  const onDown = (e) => {
    const k = e.code;
    if (ARROWS[k]) {
      e.preventDefault();
      if (e.repeat) return;
      const [x, y] = ARROWS[k];
      if (pending) {
        // A second arrow inside the window makes a diagonal; the same axis replaces.
        if (x) pending.x = x;
        if (y) pending.y = y;
        flush();
      } else {
        pending = { x, y, timer: setTimeout(flush, COMBINE_MS) };
      }
      h.used?.();
      return;
    }
    if (NUMPAD[k]) {
      e.preventDefault();
      if (!e.repeat) h.swipe(NUMPAD[k]);
      h.used?.();
      return;
    }
    if (e.repeat) return;
    switch (k) {
      case 'KeyA': h.dodge('left'); break;
      case 'KeyD': h.dodge('right'); break;
      case 'KeyS':
      case 'Space':
        e.preventDefault();
        blockKeys.add(k);
        h.block(true);
        break;
      case 'KeyW':
      case 'Enter':
      case 'NumpadEnter':
        if (!h.confirm?.()) h.superMove();
        break;
      case 'Escape':
      case 'KeyP':
        h.pause();
        break;
      default:
        return;
    }
    h.used?.();
  };
  const onUp = (e) => {
    if (blockKeys.has(e.code)) {
      blockKeys.delete(e.code);
      if (!blockKeys.size) h.block(false);
    }
  };
  const onBlur = () => {
    if (blockKeys.size) { blockKeys.clear(); h.block(false); }
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  scene.events.once('shutdown', () => {
    if (pending) clearTimeout(pending.timer);
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', onBlur);
  });
}

// Menus: Enter / Space confirm, Escape backs out, arrows step through choices.
export function bindMenuKeys(scene, keys) {
  const onDown = (e) => {
    if (e.repeat) return;
    const fn = keys[e.code] || (e.code === 'NumpadEnter' ? keys.Enter : null);
    if (fn) {
      e.preventDefault();
      fn();
    }
  };
  window.addEventListener('keydown', onDown);
  scene.events.once('shutdown', () => window.removeEventListener('keydown', onDown));
}
