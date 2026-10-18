import { PALETTE } from '../config.js';

// Heraldic charges as small pixel maps, so they match the voxel look and
// stay crisp at any size. 'X' = filled.
const MAPS = {
  lion: [
    '.....XXX........',
    '....XXXXX.......',
    '...XXXXXXX......',
    '..XX.XXXXX......',
    '.XXX.XXXXX....X.',
    'XX....XXXX...XX.',
    '......XXXXX..X..',
    '..XXX.XXXXXX.X..',
    '.XX..XXXXXXXXX..',
    '.....XXXXXXX....',
    '......XXXXXX....',
    '.....XXX.XXX....',
    '....XXX...XX....',
    '...XX.....XX....',
    '..XXX.....XXX...',
  ],
  stag: [
    'X...X.....X...X',
    'XX.XX.....XX.XX',
    '.XXX.......XXX.',
    '..XX.X...X.XX..',
    '...XXX...XXX...',
    '....XX...XX....',
    '.....XXXXX.....',
    '...XXXXXXXXX...',
    '....XXXXXXX....',
    '.....XXXXX.....',
    '.....XXXXX.....',
    '......XXX......',
    '......XXX......',
  ],
  cross: [
    '....XXX....',
    '....XXX....',
    '....XXX....',
    'XXXXXXXXXXX',
    'XXXXXXXXXXX',
    '....XXX....',
    '....XXX....',
    '....XXX....',
    '....XXX....',
    '....XXX....',
  ],
  chevron: [
    '......X......',
    '.....XXX.....',
    '....XXXXX....',
    '...XXX.XXX...',
    '..XXX...XXX..',
    '.XXX.....XXX.',
    'XXX.......XXX',
  ],
  star: [
    '.....X.....',
    '.....X.....',
    '....XXX....',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..XXXXXXX..',
    '..XXX.XXX..',
    '.XX.....XX.',
  ],
  crown: [
    'X...X...X',
    'XX.XXX.XX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXX.',
  ],
  axes: [
    'XX.......XX',
    'XXX.....XXX',
    '.XXX...XXX.',
    '...XX.XX...',
    '....XXX....',
    '...XX.XX...',
    '..XX...XX..',
    '.XX.....XX.',
  ],
};

// Draw a charge centred at (cx, cy), fitting in a box `size` wide.
export function drawCharge(ctx, kind, cx, cy, size, color = PALETTE.goldCss, outline = PALETTE.inkCss) {
  const map = MAPS[kind];
  if (!map) return;
  const cols = map[0].length;
  const rows = map.length;
  const px = Math.max(1, Math.floor(size / cols));
  const x0 = Math.round(cx - (cols * px) / 2);
  const y0 = Math.round(cy - (rows * px) / 2);
  const fill = (dx) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (map[r][c] === 'X') ctx.fillRect(x0 + c * px + dx[0], y0 + r * px + dx[1], px, px);
      }
    }
  };
  if (outline) {
    ctx.fillStyle = outline;
    const o = Math.max(1, Math.round(px / 3));
    [[-o, 0], [o, 0], [0, -o], [0, o]].forEach((d) => fill(d));
  }
  ctx.fillStyle = color;
  fill([0, 0]);
}

// Heater-shaped crest with a gold rim, as used in the tourney bar.
export function drawCrest(ctx, x, y, w, h, field, charge, chargeColor = PALETTE.goldCss) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.quadraticCurveTo(x + w, y + h * 0.9, x + w / 2, y + h);
  ctx.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.55);
  ctx.closePath();
  ctx.fillStyle = field;
  ctx.fill();
  ctx.lineWidth = Math.max(2, w * 0.07);
  ctx.strokeStyle = PALETTE.goldCss;
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = PALETTE.inkCss;
  ctx.stroke();
  ctx.clip();
  // subtle shading
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  if (charge) drawCharge(ctx, charge, x + w / 2, y + h * 0.45, w * 0.72, chargeColor);
}

export const PLAYER_CREST = { field: PALETTE.lapisCss, charge: 'lion' };

// Your knight's name; later generations get a numeral (Sir Gawain II, III...).
export function playerName(generation) {
  return generation > 1 ? `Sir Gawain ${ROMAN[generation] || generation}` : 'Sir Gawain';
}

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
