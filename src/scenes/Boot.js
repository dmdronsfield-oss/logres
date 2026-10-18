import { Save } from '../save/Save.js';
import { Sfx } from '../audio/Sfx.js';
import { setupCamera } from './common.js';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    setupCamera(this);
    Sfx.setMuted(Save.data.muted);
    const fontReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('700 32px "Cinzel"'), document.fonts.load('400 20px "Cinzel"')])
      : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([fontReady, timeout]).catch(() => {}).then(() => {
      const l = document.getElementById('loading');
      if (l) l.remove();
      this.scene.start('Title');
    });
  }
}
