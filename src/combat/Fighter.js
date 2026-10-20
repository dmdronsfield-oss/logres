// Shared health bookkeeping for the player and enemies.
export class Fighter {
  constructor(scene, maxHealth) {
    this.scene = scene;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  get healthFrac() {
    return Math.max(0, this.health / this.maxHealth);
  }

  get alive() {
    return this.health > 0;
  }

  applyDamage(amount) {
    // The cheat (tap your crest): no harm comes to you.
    if (this.invulnerable) return false;
    // minHealth lets the tutorial keep its enemy alive until the lessons are done.
    this.health = Math.max(this.minHealth || 0, this.health - amount);
    return this.health <= 0;
  }
}
