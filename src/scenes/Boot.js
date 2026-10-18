import { MODE, VIEW } from '../config.js';
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
    // The 3D test loads Three.js only when it's needed.
    const side = window.LOGRES_CAM === 'side';
    const three = MODE === '3d'
      ? import(side ? '../render3d/Hall3D.js' : '../render3d/View3D.js')
        .then((m) => { VIEW.world3d = side ? new m.HallView(this.game) : new m.World3D(this.game); return VIEW.world3d.ready; })
        .catch((e) => { console.warn('3D unavailable, falling back to 2D', e); })
      : Promise.resolve();
    Promise.all([Promise.race([fontReady, timeout]).catch(() => {}), three]).then(() => {
      const l = document.getElementById('loading');
      if (l) l.remove();
      this.scene.start('Title');
    });
  }
}
