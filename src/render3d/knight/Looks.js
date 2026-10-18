import { PALETTE } from '../../config.js';

// Liveries and harness for each figure (shared by the hall view and the animation lab).

export const PLAYER_LOOK = {
  tabard: '#24408c', trim: PALETTE.goldCss, charge: 'lion', helm: 'bascinet', helmColor: '#b9c0ca',
  plate: '#c4c9d1', mail: '#9aa0a8', cape: '#2a4796', capeCharge: 'lion', crest: '#2a4796', skin: '#e2b48a',
};

export function lookFor(def) {
  const l = def.look || {};
  const p = def.palette;
  return {
    tabard: l.tabard || p.body, trim: l.trim || p.trim || PALETTE.goldCss, charge: l.charge ?? null, chargeColor: l.chargeColor,
    helm: l.helm || 'greathelm', helmColor: l.helmColor || p.helmColor, plate: l.plate || l.metal || '#b9bec6',
    mail: l.mail || '#8f959d', cape: l.cape, capeCharge: l.capeCharge, crest: l.crest, skin: l.skin || p.skin,
    beard: l.beard || p.beard, leafy: l.leafy, antler: l.antler, blade: p.blade,
    shield: p.shield || l.tabard, shieldCharge: l.charge ?? null,
  };
}
