import { Save } from '../save/Save.js';

// Comfort mode: less camera motion and softer flashes. Follows the device's
// "reduce motion" setting until the player chooses (pause menu).
export function comfort() {
  if (Save.data.comfort === true || Save.data.comfort === false) return Save.data.comfort;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}
