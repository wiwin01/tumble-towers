// main.js — Tumble Towers: a slingshot demolition game.
//
// The Wobble Kingdom's towers have trapped the Star Sprites. You are the
// royal toppling crew: drag back the slingshot, fling boulders, and knock
// every gem cage off its pedestal. Blocks that fall score, glass shatters,
// and quick chains multiply points. Five towers, a handful of boulders
// each — run out and the sprites stay trapped.
//
// This file owns the game state and the loop; physics.js moves the bodies,
// levels.js describes the towers, render.js draws, audio.js sounds,
// effects.js juices, input.js translates events, shots.js builds the
// deterministic screenshot scenes.

import { World, makeBox, makeCircle } from './physics.js';
import { LEVELS, MATERIALS, gemCount } from './levels.js';
import { Effects } from './effects.js';
import { sfx, unlockAudio } from './audio.js';
import { drawGame, VIEW } from './render.js';
import { attachInput } from './input.js';
import { setupShot } from './shots.js';

const POWER = 10.5; // slingshot: px/s of launch speed per px of pull
const MAX_PULL = 140;
const BALL_R = 17;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 1);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const g = {
  screen: 'title',
  world: new World(1900),
  effects: new Effects(mulberry32(shotName ? seed * 7919 : 1234567)),
  levelIndex: 0,
  level: LEVELS[0],
  score: 0,
  levelScore: 0,
  scoreAtLevelStart: 0,
  bonus: 0,
  best: Number(localStorage.getItem('tumbleTowersBest') ?? 0),
  ballsLeft: 0,
  gemsTotal: 0,
  gemsFreed: 0,
  combo: 0,
  comboTimer: 0,
  loadedBall: false,
  ball: null,
  ballRest: 0,
  aim: null,
  aiming: false,
  anchor: VIEW.anchor,
  power: POWER,
  buttons: [],
  mouse: { x: -99, y: -99 },
  paused: false,
  silent: !!shotName,
  holdScreen: false,
  calmTime: 0,
  celebrating: false,
  endTimer: 0,
  lastThudAt: 0,
  pendingBreaks: [],
};

function setLevel(index) {
  g.levelIndex = index;
  g.level = LEVELS[index];
  const world = new World(1900);
  g.world = world;
  const { groundY, pedestal } = VIEW;
  world.add(makeBox({
    x: VIEW.W / 2, y: groundY + 40, w: 2600, h: 80,
    isStatic: true, kind: 'ground', friction: 0.95,
  }));
  world.add(makeBox({
    x: pedestal.cx, y: pedestal.top + (groundY - pedestal.top) / 2,
    w: pedestal.w + 16, h: groundY - pedestal.top,
    isStatic: true, kind: 'pedestal', friction: 0.85,
  }));
  for (const spec of g.level.blocks) {
    const mat = MATERIALS[spec.mat];
    world.add(makeBox({
      x: pedestal.cx + spec.x,
      y: pedestal.top + spec.y,
      w: spec.w,
      h: spec.h,
      angle: spec.angle,
      density: mat.density,
      friction: mat.friction,
      restitution: mat.restitution,
      kind: spec.mat,
    }));
  }
  world.onImpact = (a, b, speed, x, y) => onImpact(a, b, speed, x, y);
  // Settle the tower before anyone sees it: step the fresh world briefly,
  // then put every block to sleep. A sleeping tower is rock solid until a
  // boulder (or a falling neighbour) wakes it — no slow self-collapse
  // while the player is still aiming.
  for (let i = 0; i < 90; i++) world.step(1 / 120);
  for (const body of world.bodies) {
    if (body.isStatic) continue;
    body.vx = 0;
    body.vy = 0;
    body.va = 0;
    body.asleep = true;
    body.sleepTime = 0;
  }
  g.gemsTotal = gemCount(g.level);
  g.gemsFreed = 0;
  g.ballsLeft = g.level.balls;
  g.levelScore = 0;
  g.combo = 0;
  g.comboTimer = 0;
  g.ball = null;
  g.ballRest = 0;
  g.loadedBall = true;
  g.aim = null;
  g.aiming = false;
  g.calmTime = 0;
  g.celebrating = false;
  g.endTimer = 0;
  g.pendingBreaks = [];
  layoutButtons();
}

function layoutButtons() {
  const cx = VIEW.W / 2;
  if (g.screen === 'title') {
    g.buttons = [{ id: 'play', label: '▶  Topple!', x: cx - 115, y: 428, w: 230, h: 58 }];
  } else if (g.screen === 'clear') {
    g.buttons = [{ id: 'next', label: 'Next Tower ▶', x: cx - 120, y: 404, w: 240, h: 54 }];
  } else if (g.screen === 'over') {
    g.buttons = [
      { id: 'retry', label: '↻ Try Again', x: cx - 215, y: 404, w: 200, h: 54 },
      { id: 'title', label: 'Title', x: cx + 15, y: 404, w: 200, h: 54 },
    ];
  } else if (g.screen === 'win') {
    g.buttons = [
      { id: 'again', label: '↻ Play Again', x: cx - 215, y: 404, w: 200, h: 54 },
      { id: 'title', label: 'Title', x: cx + 15, y: 404, w: 200, h: 54 },
    ];
  } else {
    g.buttons = [];
  }
}

function startGame() {
  g.score = 0;
  g.scoreAtLevelStart = 0;
  g.screen = 'play';
  setLevel(0);
}

function nextLevel() {
  g.scoreAtLevelStart = g.score;
  g.screen = 'play';
  setLevel(g.levelIndex + 1);
}

function retryLevel() {
  g.score = g.scoreAtLevelStart;
  g.screen = 'play';
  setLevel(g.levelIndex);
}

function toTitle() {
  g.screen = 'title';
  setLevel(0);
}

function pressButton(id) {
  sfx.click();
  if (id === 'play' || id === 'again') startGame();
  else if (id === 'next') nextLevel();
  else if (id === 'retry') retryLevel();
  else if (id === 'title') toTitle();
}

function clampPull(pos) {
  const dx = pos.x - g.anchor.x;
  const dy = pos.y - g.anchor.y;
  const len = Math.hypot(dx, dy);
  if (len <= MAX_PULL) return { x: pos.x, y: pos.y };
  return { x: g.anchor.x + (dx / len) * MAX_PULL, y: g.anchor.y + (dy / len) * MAX_PULL };
}

function fireBall(pullPos) {
  const ball = makeCircle({
    x: pullPos.x, y: pullPos.y, r: BALL_R,
    density: 0.014, friction: 0.45, restitution: 0.12, kind: 'ball',
  });
  ball.vx = (g.anchor.x - pullPos.x) * POWER;
  ball.vy = (g.anchor.y - pullPos.y) * POWER;
  g.world.add(ball);
  g.ball = ball;
  g.ballRest = 0;
  g.loadedBall = false;
  g.ballsLeft -= 1;
  g.calmTime = 0;
  if (!g.silent) sfx.launch(Math.hypot(ball.vx, ball.vy) / 12);
}

function addScore(base, x, y, big = false) {
  g.combo = g.comboTimer > 0 ? Math.min(g.combo + 1, 6) : 1;
  g.comboTimer = 1.4;
  const mult = 1 + (g.combo - 1) * 0.5;
  const points = Math.round(base * mult);
  g.score += points;
  g.levelScore += points;
  const label = g.combo >= 2 ? `+${points} CHAIN x${mult}` : `+${points}`;
  g.effects.popup(x, y, label, big ? '#ffd94d' : '#ffffff', big);
}

function onImpact(a, b, speed, x, y) {
  const now = performance.now();
  if (speed > 200 && now - g.lastThudAt > 70) {
    g.lastThudAt = now;
    if (!g.silent) sfx.thud(speed);
    if (speed > 560) g.effects.dust(x, y);
    if (speed > 780) g.effects.shake(Math.min(9, 3 + (speed - 780) / 70), 0.3);
  }
  for (const body of [a, b]) {
    if (body.kind === 'glass' && speed > 560 && !body.broken) {
      body.broken = true;
      g.pendingBreaks.push(body);
    }
    if (body.kind === 'gem' && speed > 320) g.effects.sparkle(x, y);
  }
}

function stepFixed(dt) {
  if (g.screen !== 'play' || g.paused) return;
  g.world.step(dt / 2);
  g.world.step(dt / 2);

  for (const body of g.pendingBreaks) {
    g.world.remove(body);
    g.effects.splinters(body.x, body.y, '#bfe8ef');
    if (!g.silent) sfx.glassBreak();
    addScore(MATERIALS.glass.score, body.x, body.y - 10);
    for (const other of g.world.bodies) if (!other.isStatic) g.world.wake(other);
  }
  g.pendingBreaks = [];

  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) g.combo = 0;
  }

  const { pedestal } = VIEW;
  for (const body of g.world.bodies) {
    if (body.kind === 'gem' && !body.freed && body.y > pedestal.top + 34) {
      body.freed = true;
      g.gemsFreed += 1;
      g.effects.sparkle(body.x, body.y);
      g.effects.stop(0.05);
      if (!g.silent) sfx.gemFreed();
      addScore(300, body.x, body.y - 34, true);
      if (g.gemsFreed >= g.gemsTotal && !g.celebrating) {
        g.celebrating = true;
        g.endTimer = 1.05;
        g.effects.slow(0.7);
        g.effects.shake(4, 0.3);
      }
    }
    if ((body.kind === 'wood' || body.kind === 'stone') && !body.scored
      && body.y - body.homeY > 46) {
      body.scored = true;
      if (!g.silent) sfx.topple();
      addScore(MATERIALS[body.kind].score, body.x, body.y - 16);
    }
  }

  if (g.ball) {
    const ball = g.ball;
    const speed2 = ball.vx * ball.vx + ball.vy * ball.vy;
    const gone = ball.x > 1500 || ball.x < -140 || ball.y > 840;
    if (!gone && speed2 < 46 * 46 && ball.contactCount > 0) g.ballRest += dt;
    else g.ballRest = 0;
    if (gone || g.ballRest > 0.7) {
      g.world.remove(ball);
      g.ball = null;
      if (!g.celebrating && g.ballsLeft > 0) g.loadedBall = true;
    }
  }

  const anyMoving = g.world.bodies.some(
    (b) => !b.isStatic && !b.asleep && b.vx * b.vx + b.vy * b.vy > 42 * 42,
  );
  g.calmTime = anyMoving ? 0 : g.calmTime + dt;

  if (g.holdScreen) return;
  if (g.celebrating) {
    g.endTimer -= dt;
    if (g.endTimer <= 0) finishLevel();
  } else if (!g.ball && !g.loadedBall && g.ballsLeft === 0
    && g.calmTime > 0.7 && g.gemsFreed < g.gemsTotal) {
    g.screen = 'over';
    saveBest();
    if (!g.silent) sfx.lose();
    layoutButtons();
  }
}

function finishLevel() {
  g.celebrating = false;
  g.bonus = g.ballsLeft * 150;
  g.score += g.bonus;
  g.levelScore += g.bonus;
  saveBest();
  if (!g.silent) sfx.win();
  g.screen = g.levelIndex + 1 >= LEVELS.length ? 'win' : 'clear';
  layoutButtons();
}

function saveBest() {
  if (g.score > g.best) {
    g.best = g.score;
    localStorage.setItem('tumbleTowersBest', String(g.best));
  }
}

attachInput(canvas, {
  down(pos) {
    unlockAudio();
    g.mouse = pos;
    if (g.screen !== 'play') {
      const hit = g.buttons.find(
        (b) => pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h,
      );
      if (hit) pressButton(hit.id);
      return;
    }
    if (g.paused || !g.loadedBall) return;
    if (Math.hypot(pos.x - g.anchor.x, pos.y - g.anchor.y) <= 170) {
      g.aiming = true;
      g.aim = clampPull(pos);
    }
  },
  move(pos) {
    g.mouse = pos;
    if (g.aiming) {
      g.aim = clampPull(pos);
      if (!g.silent && Math.random() < 0.25) {
        sfx.stretch(Math.hypot(g.anchor.x - g.aim.x, g.anchor.y - g.aim.y));
      }
    }
  },
  up() {
    if (!g.aiming) return;
    g.aiming = false;
    const pull = Math.hypot(g.anchor.x - g.aim.x, g.anchor.y - g.aim.y);
    if (pull >= 26) fireBall(g.aim);
    g.aim = null;
  },
  key(key) {
    if (key === 'p' || key === 'P') {
      if (g.screen === 'play') g.paused = !g.paused;
    } else if (key === 'r' || key === 'R') {
      if (g.screen === 'play' || g.screen === 'over') retryLevel();
    } else if (key === ' ' || key === 'Enter') {
      unlockAudio();
      if (g.screen === 'title') startGame();
      else if (g.screen === 'clear') nextLevel();
      else if (g.screen === 'over') retryLevel();
      else if (g.screen === 'win') startGame();
    }
  },
});

g.setLevel = setLevel;
g.fireBall = fireBall;
g.layoutButtons = layoutButtons;

setLevel(0);
g.screen = 'title';
layoutButtons();

if (shotName) {
  g.holdScreen = shotName === 'play';
  setupShot(g, shotName, stepFixed);
}

let last = performance.now();
let frames = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  const scale = g.effects.update(dt);
  if (g.screen === 'play' && !g.paused) stepFixed(dt * scale);
  drawGame(ctx, g, now / 1000);
  frames += 1;
  if (shotName && frames >= 3) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
