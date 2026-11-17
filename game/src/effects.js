// effects.js — the juice: particles, floating score popups, screen shake,
// hit-stop and brief slow motion. None of it changes the physics; all of it
// makes a hit *feel* like a hit, which is half of what a demolition game is.

export class Effects {
  constructor(rng) {
    this.particles = [];
    this.popups = [];
    this.rng = rng;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.hitStop = 0;
    this.slowMo = 0;
  }

  burst(x, y, color, count, speed = 260, life = 0.6, size = 4) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const v = speed * (0.3 + this.rng() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 120,
        life: life * (0.5 + this.rng() * 0.8),
        maxLife: life,
        size: size * (0.5 + this.rng()),
        color,
        spin: (this.rng() - 0.5) * 12,
        angle: this.rng() * Math.PI,
      });
    }
  }

  splinters(x, y, color) {
    this.burst(x, y, color, 16, 340, 0.7, 5);
  }

  sparkle(x, y) {
    this.burst(x, y, '#ffe873', 26, 220, 0.9, 4);
    this.burst(x, y, '#fff6c8', 12, 120, 1.1, 3);
  }

  dust(x, y) {
    this.burst(x, y, 'rgba(196,178,150,0.8)', 8, 110, 0.55, 6);
  }

  popup(x, y, text, color = '#ffffff', big = false) {
    this.popups.push({ x, y, text, color, life: big ? 1.25 : 0.95, maxLife: big ? 1.25 : 0.95, big });
  }

  shake(magnitude, seconds = 0.28) {
    this.shakeMag = Math.max(this.shakeMag, magnitude);
    this.shakeTime = Math.max(this.shakeTime, seconds);
  }

  stop(seconds) {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  slow(seconds) {
    this.slowMo = Math.max(this.slowMo, seconds);
  }

  // Returns the time scale physics should run at this frame.
  update(dt) {
    let scale = 1;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      scale = 0.05;
    } else if (this.slowMo > 0) {
      this.slowMo -= dt;
      scale = 0.35;
    }
    if (this.shakeTime > 0) this.shakeTime -= dt;
    else this.shakeMag = 0;

    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 620 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 44 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    return scale;
  }

  shakeOffset() {
    if (this.shakeMag <= 0 || this.shakeTime <= 0) return { x: 0, y: 0 };
    const m = this.shakeMag * Math.min(1, this.shakeTime / 0.2);
    return { x: (this.rng() - 0.5) * 2 * m, y: (this.rng() - 0.5) * 2 * m };
  }

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    for (const p of this.popups) {
      const alpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.5)));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = p.big ? '700 30px system-ui, sans-serif' : '700 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40,26,10,0.75)';
      const text = String(p.text);
      ctx.strokeText(text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(text, p.x, p.y);
      ctx.restore();
    }
  }
}
