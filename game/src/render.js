// render.js — everything Tumble Towers draws: the dusk sky over the Wobble
// Kingdom, the stone pedestal, the towers block by block, the slingshot,
// the HUD, and the title / clear / game-over / victory panels. Pure canvas,
// no images: every sprite is drawn from code so the game ships as text.

import { MATERIALS } from './levels.js';

export const VIEW = {
  W: 1280,
  H: 720,
  groundY: 656,
  pedestal: { cx: 850, top: 560, w: 470 },
  anchor: { x: 185, y: 474 },
};

export function drawGame(ctx, g, t) {
  const { W, H } = VIEW;
  ctx.clearRect(0, 0, W, H);
  const off = g.effects.shakeOffset();
  ctx.save();
  ctx.translate(off.x, off.y);
  drawSky(ctx, t);
  drawGround(ctx);
  drawPedestal(ctx);
  drawSlingshotBack(ctx, g);
  for (const body of g.world.bodies) {
    if (body.kind === 'ground' || body.kind === 'pedestal') continue;
    drawBody(ctx, body, t);
  }
  drawLoadedBall(ctx, g);
  drawSlingshotFront(ctx, g);
  drawAimGuide(ctx, g);
  g.effects.draw(ctx);
  ctx.restore();

  if (g.screen !== 'title') drawHud(ctx, g);
  if (g.screen === 'title') drawTitle(ctx, g, t);
  if (g.screen === 'clear') drawPanel(ctx, g, 'Level Clear!', clearLines(g), g.buttons);
  if (g.screen === 'over') drawPanel(ctx, g, 'Out of Boulders', overLines(g), g.buttons);
  if (g.screen === 'win') drawPanel(ctx, g, 'The Kingdom is Wobbled!', winLines(g), g.buttons);
  if (g.paused) drawPaused(ctx);
}

function drawSky(ctx, t) {
  const { W, groundY } = VIEW;
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, '#2e4a7d');
  grad.addColorStop(0.55, '#7a6a9e');
  grad.addColorStop(0.82, '#e8906f');
  grad.addColorStop(1, '#f7c873');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, groundY + 2);

  // Sun, low and golden.
  const sunX = 1090;
  const sunY = 128;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 130);
  glow.addColorStop(0, 'rgba(255,236,170,0.9)');
  glow.addColorStop(0.35, 'rgba(255,205,110,0.45)');
  glow.addColorStop(1, 'rgba(255,205,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Drifting clouds.
  ctx.fillStyle = 'rgba(255,230,210,0.5)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 317 + t * (6 + i * 2)) % (VIEW.W + 240)) - 120;
    const cy = 60 + i * 34;
    cloud(ctx, cx, cy, 46 + i * 9);
  }

  // Far hills.
  ctx.fillStyle = '#5d5480';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= VIEW.W; x += 40) {
    ctx.lineTo(x, groundY - 60 - Math.sin(x * 0.006 + 1.7) * 42 - Math.sin(x * 0.017) * 12);
  }
  ctx.lineTo(VIEW.W, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a4470';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= VIEW.W; x += 40) {
    ctx.lineTo(x, groundY - 26 - Math.sin(x * 0.009 + 4.2) * 26);
  }
  ctx.lineTo(VIEW.W, groundY);
  ctx.closePath();
  ctx.fill();
}

function cloud(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x + r * 0.5, y + 4, r * 0.42, 0, Math.PI * 2);
  ctx.arc(x - r * 0.5, y + 5, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround(ctx) {
  const { W, H, groundY } = VIEW;
  ctx.fillStyle = '#69a84f';
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = '#578f40';
  ctx.fillRect(0, groundY, W, 7);
  ctx.fillStyle = 'rgba(46,94,32,0.5)';
  for (let x = 12; x < W; x += 47) {
    const y = groundY + 18 + ((x * 37) % 34);
    ctx.fillRect(x, y, 9, 3);
    ctx.fillRect(x + 21, y + 9, 6, 3);
  }
}

function drawPedestal(ctx) {
  const { cx, top, w } = VIEW.pedestal;
  const { groundY } = VIEW;
  const x = cx - w / 2;
  const h = groundY - top;
  ctx.fillStyle = '#8d949e';
  ctx.fillRect(x, top, w, h);
  ctx.fillStyle = '#767e89';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 7; col++) {
      ctx.fillRect(x + 8 + col * 66 + (row % 2) * 30, top + 10 + row * 30, 52, 20);
    }
  }
  ctx.fillStyle = '#a7afb9';
  ctx.fillRect(x - 8, top - 8, w + 16, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 8, top + 4, w + 16, 4);
}

export function drawStar(ctx, x, y, r, color) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.48;
    const px = x + Math.cos(angle) * rad;
    const py = y + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawBody(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  if (b.shape === 'circle') {
    // The boulder.
    ctx.fillStyle = '#7c828c';
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#959ca6';
    ctx.beginPath();
    ctx.arc(-b.r * 0.3, -b.r * 0.32, b.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,42,48,0.35)';
    ctx.beginPath();
    ctx.arc(b.r * 0.34, b.r * 0.3, b.r * 0.16, 0, Math.PI * 2);
    ctx.arc(-b.r * 0.5, b.r * 0.42, b.r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.kind === 'gem') {
    const w = b.hw * 2;
    const h = b.hh * 2;
    ctx.shadowColor = b.freed ? 'rgba(255,220,90,0.95)' : 'rgba(255,214,64,0.65)';
    ctx.shadowBlur = 18 + Math.sin(t * 3 + b.id) * 5;
    ctx.fillStyle = MATERIALS.gem.fill;
    ctx.fillRect(-b.hw, -b.hh, w, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = MATERIALS.gem.edge;
    ctx.lineWidth = 3;
    ctx.strokeRect(-b.hw + 1.5, -b.hh + 1.5, w - 3, h - 3);
    drawStar(ctx, 0, 0, Math.min(b.hw, b.hh) * 0.62, '#fff3b0');
  } else {
    const mat = MATERIALS[b.kind];
    const w = b.hw * 2;
    const h = b.hh * 2;
    if (b.kind === 'glass') ctx.globalAlpha = 0.82;
    ctx.fillStyle = mat.fill;
    ctx.fillRect(-b.hw, -b.hh, w, h);
    ctx.strokeStyle = mat.edge;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-b.hw + 1, -b.hh + 1, w - 2, h - 2);
    if (b.kind === 'wood') {
      ctx.strokeStyle = 'rgba(120,74,32,0.45)';
      ctx.lineWidth = 1.4;
      const lines = Math.max(1, Math.floor(Math.min(w, h) / 16));
      for (let i = 1; i <= lines; i++) {
        ctx.beginPath();
        if (w >= h) {
          ctx.moveTo(-b.hw + 5, -b.hh + (h * i) / (lines + 1));
          ctx.lineTo(b.hw - 5, -b.hh + (h * i) / (lines + 1));
        } else {
          ctx.moveTo(-b.hw + (w * i) / (lines + 1), -b.hh + 5);
          ctx.lineTo(-b.hw + (w * i) / (lines + 1), b.hh - 5);
        }
        ctx.stroke();
      }
    } else if (b.kind === 'stone') {
      ctx.fillStyle = 'rgba(52,58,66,0.3)';
      ctx.beginPath();
      ctx.arc(-b.hw * 0.4, -b.hh * 0.3, 3, 0, Math.PI * 2);
      ctx.arc(b.hw * 0.3, b.hh * 0.25, 4, 0, Math.PI * 2);
      ctx.arc(b.hw * 0.55, -b.hh * 0.45, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'glass') {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-b.hw + 6, b.hh - 6);
      ctx.lineTo(b.hw - 12, -b.hh + 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSlingshotBack(ctx, g) {
  const { anchor, groundY } = VIEW;
  ctx.strokeStyle = '#7a4b21';
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(anchor.x - 4, groundY);
  ctx.lineTo(anchor.x - 2, anchor.y + 26);
  ctx.stroke();
  if (g.loadedBall && g.aim) {
    ctx.strokeStyle = '#4d2c14';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(anchor.x - 16, anchor.y - 12);
    ctx.lineTo(g.aim.x, g.aim.y);
    ctx.stroke();
  }
}

function drawSlingshotFront(ctx, g) {
  const { anchor } = VIEW;
  ctx.strokeStyle = '#8a5a28';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(anchor.x + 16, anchor.y + 30);
  ctx.lineTo(anchor.x + 15, anchor.y - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(anchor.x - 16, anchor.y + 30);
  ctx.lineTo(anchor.x - 15, anchor.y - 14);
  ctx.stroke();
  if (g.loadedBall && g.aim) {
    ctx.strokeStyle = '#4d2c14';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(anchor.x + 15, anchor.y - 12);
    ctx.lineTo(g.aim.x, g.aim.y);
    ctx.stroke();
  }
}

function drawLoadedBall(ctx, g) {
  if (!g.loadedBall) return;
  const pos = g.aim ?? VIEW.anchor;
  drawBody(ctx, { shape: 'circle', r: 17, x: pos.x, y: pos.y, angle: 0, kind: 'ball', id: 0 }, 0);
}

function drawAimGuide(ctx, g) {
  if (!g.aim || !g.loadedBall) return;
  const { anchor } = VIEW;
  const vx = (anchor.x - g.aim.x) * g.power;
  const vy = (anchor.y - g.aim.y) * g.power;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  let x = g.aim.x;
  let y = g.aim.y;
  let pvx = vx;
  let pvy = vy;
  const dt = 0.055;
  for (let i = 0; i < 16; i++) {
    pvy += 1900 * dt;
    x += pvx * dt;
    y += pvy * dt;
    if (y > VIEW.groundY) break;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 4.2 - i * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Pull power meter.
  const pull = Math.hypot(anchor.x - g.aim.x, anchor.y - g.aim.y);
  ctx.fillStyle = 'rgba(20,16,30,0.55)';
  ctx.fillRect(anchor.x - 60, anchor.y + 66, 120, 12);
  ctx.fillStyle = pull > 110 ? '#ff7a59' : '#ffd94d';
  ctx.fillRect(anchor.x - 57, anchor.y + 69, 114 * Math.min(1, pull / 140), 6);
}

function drawHud(ctx, g) {
  const { W } = VIEW;
  ctx.fillStyle = 'rgba(24,20,38,0.62)';
  ctx.fillRect(0, 0, W, 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Level ${g.levelIndex + 1} · ${g.level.name}`, 18, 34);
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(`Score ${g.score}`, 330, 34);

  // Gems freed, as stars.
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Sprites freed', 620, 33);
  for (let i = 0; i < g.gemsTotal; i++) {
    drawStar(ctx, 742 + i * 30, 26, 11, i < g.gemsFreed ? '#ffd94d' : 'rgba(255,255,255,0.28)');
  }
  // Boulders left, as stones.
  ctx.fillText('Boulders', 950, 33);
  for (let i = 0; i < g.level.balls; i++) {
    ctx.beginPath();
    ctx.fillStyle = i < g.ballsLeft ? '#aeb6c2' : 'rgba(255,255,255,0.22)';
    ctx.arc(1032 + i * 28, 26, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (g.combo > 1 && g.comboTimer > 0) {
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(`CHAIN x${g.combo}`, W / 2, 84);
    ctx.fillStyle = 'rgba(255,217,77,0.5)';
    ctx.fillRect(W / 2 - 50, 92, 100 * Math.max(0, g.comboTimer / 1.4), 5);
  }
  if (g.screen === 'play') {
    ctx.font = '500 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Drag the boulder · R restart · P pause', 14, VIEW.H - 12);
  }
}

function drawTitle(ctx, g, t) {
  const { W } = VIEW;
  ctx.fillStyle = 'rgba(24,18,40,0.35)';
  ctx.fillRect(0, 0, W, VIEW.H);
  ctx.textAlign = 'center';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(58,32,8,0.85)';
  const bob = Math.sin(t * 1.4) * 5;
  ctx.strokeText('TUMBLE TOWERS', W / 2, 168 + bob);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('TUMBLE TOWERS', W / 2, 168 + bob);
  ctx.font = '600 23px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Fling boulders. Topple the towers. Free every Star Sprite.', W / 2, 216 + bob);
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText('Drag back on the boulder, aim the dotted arc, and let go.', W / 2, 258);
  ctx.fillText('Glass shatters, towers chain-topple, and every fallen block scores.', W / 2, 284);
  if (g.best > 0) {
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`Best score: ${g.best}`, W / 2, 330);
  }
  drawButtons(ctx, g);
}

function clearLines(g) {
  return [
    `Level score: ${g.levelScore}`,
    `Boulder bonus: ${g.bonus}`,
    `Total score: ${g.score}`,
    g.levelIndex + 1 < 5 ? 'The next tower is taller...' : 'That was the last tower!',
  ];
}

function overLines(g) {
  return [
    `${g.gemsTotal - g.gemsFreed} Star Sprite(s) still trapped.`,
    `Score: ${g.score}`,
    'Tip: aim low at the posts — a tower falls from its feet.',
  ];
}

function winLines(g) {
  return [
    `Final score: ${g.score}`,
    `Best score: ${g.best}`,
    'Every Star Sprite is free. The kingdom wobbles no more.',
  ];
}

function drawPanel(ctx, g, title, lines, buttons) {
  const { W, H } = VIEW;
  ctx.fillStyle = 'rgba(20,16,34,0.55)';
  ctx.fillRect(0, 0, W, H);
  const pw = 520;
  const ph = 300;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2 - 30;
  ctx.fillStyle = '#f7ead2';
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.fill();
  ctx.strokeStyle = '#8a5a28';
  ctx.lineWidth = 4;
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5a3a14';
  ctx.font = '800 36px system-ui, sans-serif';
  ctx.fillText(title, W / 2, py + 58);
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillStyle = '#6b4a22';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, py + 108 + i * 30));
  drawButtons(ctx, g);
}

function drawPaused(ctx) {
  const { W, H } = VIEW;
  ctx.fillStyle = 'rgba(20,16,34,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText('Paused', W / 2, H / 2);
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('Press P to keep toppling', W / 2, H / 2 + 34);
}

export function drawButtons(ctx, g) {
  for (const b of g.buttons) {
    const hover = g.mouse.x >= b.x && g.mouse.x <= b.x + b.w && g.mouse.y >= b.y && g.mouse.y <= b.y + b.h;
    ctx.fillStyle = hover ? '#ffb84d' : '#f0a832';
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#8a5a28';
    ctx.lineWidth = 3;
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.stroke();
    ctx.fillStyle = '#4a2c08';
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 7);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
