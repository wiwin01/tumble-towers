// physics.js — the little rigid-body engine under Tumble Towers.
//
// Bodies are boxes and circles with position, angle, velocity and spin.
// Contacts come from circle/circle, circle/box and box/box (SAT) tests and
// are solved with sequential impulses: friction and restitution in the
// velocity pass, a linear positional pass to push overlaps apart, and
// sleeping bodies so a tall stack can come to rest instead of jittering.
// The engine knows nothing about the game: it reports hard impacts through
// a callback and the game decides what breaks, scores or chimes.

let nextBodyId = 1;

export function makeBox(options) {
  const density = options.density ?? 1;
  const mass = density * options.w * options.h;
  const inertia = (mass * (options.w * options.w + options.h * options.h)) / 12;
  return baseBody(options, {
    shape: 'box',
    hw: options.w / 2,
    hh: options.h / 2,
    mass,
    invMass: options.isStatic ? 0 : 1 / mass,
    invInertia: options.isStatic ? 0 : 1 / inertia,
  });
}

export function makeCircle(options) {
  const density = options.density ?? 1;
  const mass = density * Math.PI * options.r * options.r;
  const inertia = 0.5 * mass * options.r * options.r;
  return baseBody(options, {
    shape: 'circle',
    r: options.r,
    mass,
    invMass: options.isStatic ? 0 : 1 / mass,
    invInertia: options.isStatic ? 0 : 1 / inertia,
  });
}

function baseBody(options, shapeFields) {
  return {
    id: nextBodyId++,
    kind: options.kind ?? 'wood',
    x: options.x,
    y: options.y,
    vx: 0,
    vy: 0,
    angle: options.angle ?? 0,
    va: 0,
    friction: options.friction ?? 0.55,
    restitution: options.restitution ?? 0.05,
    isStatic: !!options.isStatic,
    asleep: false,
    sleepTime: 0,
    contactCount: 0,
    homeY: options.y,
    scored: false,
    freed: false,
    broken: false,
    maxImpact: 0,
    ...shapeFields,
  };
}

export class World {
  constructor(gravity = 1900) {
    this.gravity = gravity;
    this.bodies = [];
    this.onImpact = null; // (bodyA, bodyB, speed, x, y) => void
  }

  add(body) {
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    const at = this.bodies.indexOf(body);
    if (at >= 0) this.bodies.splice(at, 1);
  }

  wake(body) {
    body.asleep = false;
    body.sleepTime = 0;
  }

  step(dt) {
    const bodies = this.bodies;
    for (const b of bodies) {
      b.maxImpact = 0;
      b.contactCount = 0;
      if (b.isStatic || b.asleep) continue;
      b.vy += this.gravity * dt;
      // A whisper of damping: residual jitter dies instead of walking a
      // resting tower apart over the next minute.
      const damp = 1 - 0.1 * dt;
      b.vx *= damp;
      b.vy *= damp;
      b.va *= 1 - 0.6 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.va * dt;
    }

    const contacts = [];
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.isStatic && b.isStatic) continue;
        // Pairs of sleeping bodies still generate contacts (the solvers
        // ignore them: both inverse masses read as 0). The contacts keep
        // contactCount truthful, which the support-loss wake below reads —
        // skipping them made every sleeping stack look unsupported and
        // woke the whole tower every step.
        if (!broadphaseOverlap(a, b)) continue;
        collide(a, b, contacts);
      }
    }
    for (const c of contacts) {
      c.a.contactCount++;
      c.b.contactCount++;
    }

    // A sleeping body whose support vanished must fall, not float; and a
    // sleeping body touched by a partner that is genuinely moving must
    // wake, so a collapse propagates up a stack instead of leaving the
    // top blocks hovering on air.
    for (const b of bodies) {
      if (b.asleep && !b.isStatic && b.contactCount === 0) this.wake(b);
    }
    for (const c of contacts) {
      if (c.a.asleep && !c.b.asleep && c.b.vx * c.b.vx + c.b.vy * c.b.vy > 55 * 55) this.wake(c.a);
      if (c.b.asleep && !c.a.asleep && c.a.vx * c.a.vx + c.a.vy * c.a.vy > 55 * 55) this.wake(c.b);
    }

    for (let iter = 0; iter < 10; iter++) {
      for (const c of contacts) solveVelocity(c, iter === 0, this);
    }
    // Positional correction, Jacobi style: every contact suggests a move
    // for its two bodies, each body applies the AVERAGE of its suggestions.
    // Summing them instead (Gauss-Seidel) lets a body resting on many
    // sleeping or static contacts be ejected by the full correction several
    // times over — the bug that used to launch tower beams through roofs.
    const deltas = new Map();
    for (const c of contacts) accumulatePosition(c, deltas);
    for (const [body, d] of deltas) {
      body.x += d.x / d.n;
      body.y += d.y / d.n;
    }

    for (const b of bodies) {
      if (b.isStatic || b.asleep) continue;
      const speed2 = b.vx * b.vx + b.vy * b.vy;
      if (speed2 < 38 * 38 && Math.abs(b.va) < 0.12 && b.contactCount > 0) {
        b.sleepTime += dt;
        if (b.sleepTime > 0.35) {
          b.asleep = true;
          b.vx = 0;
          b.vy = 0;
          b.va = 0;
        }
      } else {
        b.sleepTime = 0;
      }
    }
  }
}

function broadphaseOverlap(a, b) {
  const ra = a.shape === 'circle' ? a.r : Math.hypot(a.hw, a.hh);
  const rb = b.shape === 'circle' ? b.r : Math.hypot(b.hw, b.hh);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy < (ra + rb) * (ra + rb);
}

function collide(a, b, out) {
  if (a.shape === 'circle' && b.shape === 'circle') return circleCircle(a, b, out);
  if (a.shape === 'box' && b.shape === 'box') return boxBox(a, b, out);
  if (a.shape === 'circle' && b.shape === 'box') return circleBox(a, b, out, false);
  return circleBox(b, a, out, true);
}

function pushContact(out, a, b, nx, ny, pen, px, py) {
  if (pen <= 0) return;
  out.push({ a, b, nx, ny, pen, px, py, jn: 0, jt: 0 });
}

function circleCircle(a, b, out) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const pen = a.r + b.r - dist;
  if (pen <= 0) return;
  const nx = dist > 0.001 ? dx / dist : 1;
  const ny = dist > 0.001 ? dy / dist : 0;
  pushContact(out, a, b, nx, ny, pen, a.x + nx * (a.r - pen / 2), a.y + ny * (a.r - pen / 2));
}

function circleBox(circle, box, out, flipped) {
  const cos = Math.cos(-box.angle);
  const sin = Math.sin(-box.angle);
  const dx = circle.x - box.x;
  const dy = circle.y - box.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const cx = Math.max(-box.hw, Math.min(box.hw, lx));
  const cy = Math.max(-box.hh, Math.min(box.hh, ly));
  let nx;
  let ny;
  let pen;
  let px;
  let py;
  if (cx === lx && cy === ly) {
    // Circle centre is inside the box: leave through the nearest face.
    const toRight = box.hw - lx;
    const toLeft = lx + box.hw;
    const toBottom = box.hh - ly;
    const toTop = ly + box.hh;
    const min = Math.min(toRight, toLeft, toBottom, toTop);
    let lnx = 0;
    let lny = 0;
    if (min === toRight) lnx = 1;
    else if (min === toLeft) lnx = -1;
    else if (min === toBottom) lny = 1;
    else lny = -1;
    pen = circle.r + min;
    const bcos = Math.cos(box.angle);
    const bsin = Math.sin(box.angle);
    nx = lnx * bcos - lny * bsin;
    ny = lnx * bsin + lny * bcos;
    px = circle.x;
    py = circle.y;
  } else {
    const ddx = lx - cx;
    const ddy = ly - cy;
    const dist = Math.hypot(ddx, ddy);
    pen = circle.r - dist;
    if (pen <= 0) return;
    const bcos = Math.cos(box.angle);
    const bsin = Math.sin(box.angle);
    nx = (ddx / dist) * bcos - (ddy / dist) * bsin;
    ny = (ddx / dist) * bsin + (ddy / dist) * bcos;
    px = box.x + cx * bcos - cy * bsin;
    py = box.y + cx * bsin + cy * bcos;
  }
  // nx, ny point from the box toward the circle; a contact's normal must
  // point from its first body to its second, so exactly one case negates.
  if (flipped) pushContact(out, box, circle, nx, ny, pen, px, py);
  else pushContact(out, circle, box, -nx, -ny, pen, px, py);
}

function axesOf(b) {
  const cos = Math.cos(b.angle);
  const sin = Math.sin(b.angle);
  return [{ x: cos, y: sin }, { x: -sin, y: cos }];
}

function projRadius(b, axis) {
  const cos = Math.cos(b.angle);
  const sin = Math.sin(b.angle);
  return Math.abs(axis.x * cos + axis.y * sin) * b.hw
    + Math.abs(axis.x * -sin + axis.y * cos) * b.hh;
}

// The face of `box` whose outward normal best matches (nx, ny), as a
// segment p1..p2 with its centre and tangent.
function bestFace(box, nx, ny) {
  const cos = Math.cos(box.angle);
  const sin = Math.sin(box.angle);
  const faces = [
    { nx: cos, ny: sin, tx: -sin, ty: cos, halfN: box.hw, halfT: box.hh },
    { nx: -cos, ny: -sin, tx: sin, ty: -cos, halfN: box.hw, halfT: box.hh },
    { nx: -sin, ny: cos, tx: cos, ty: sin, halfN: box.hh, halfT: box.hw },
    { nx: sin, ny: -cos, tx: -cos, ty: -sin, halfN: box.hh, halfT: box.hw },
  ];
  let best = faces[0];
  let bestDot = -Infinity;
  for (const f of faces) {
    const d = f.nx * nx + f.ny * ny;
    if (d > bestDot) {
      bestDot = d;
      best = f;
    }
  }
  const cx = box.x + best.nx * best.halfN;
  const cy = box.y + best.ny * best.halfN;
  return {
    nx: best.nx, ny: best.ny, tx: best.tx, ty: best.ty,
    cx, cy,
    p1: { x: cx - best.tx * best.halfT, y: cy - best.ty * best.halfT },
    p2: { x: cx + best.tx * best.halfT, y: cy + best.ty * best.halfT },
  };
}

// Keep the part of segment p1..p2 where dot(n, p) <= offset.
function clipSegment(p1, p2, nx, ny, offset) {
  const d1 = nx * p1.x + ny * p1.y - offset;
  const d2 = nx * p2.x + ny * p2.y - offset;
  const kept = [];
  if (d1 <= 0) kept.push(p1);
  if (d2 <= 0) kept.push(p2);
  if (d1 * d2 < 0) {
    const t = d1 / (d1 - d2);
    kept.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
  }
  return kept;
}

function boxBox(a, b, out) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let bestAxis = null;
  let bestOverlap = Infinity;
  let bestFromA = true;
  for (const [body, fromA] of [[a, true], [b, false]]) {
    for (const axis of axesOf(body)) {
      const overlap = projRadius(a, axis) + projRadius(b, axis)
        - Math.abs(dx * axis.x + dy * axis.y);
      if (overlap <= 0) return;
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        bestAxis = axis;
        bestFromA = fromA;
      }
    }
  }
  let nx = bestAxis.x;
  let ny = bestAxis.y;
  if (dx * nx + dy * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  // Reference face on one box, incident face on the other; clip the
  // incident segment to the reference face's span so a beam resting on a
  // post gets two true contact points, one near each end of the overlap.
  const ref = bestFromA ? bestFace(a, nx, ny) : bestFace(b, -nx, -ny);
  const inc = bestFromA ? bestFace(b, -nx, -ny) : bestFace(a, nx, ny);
  let points = [inc.p1, inc.p2];
  points = clipSegment(points[0], points[1], ref.tx, ref.ty, ref.tx * ref.p2.x + ref.ty * ref.p2.y);
  if (points.length) {
    points = clipSegment(points[0], points[1] ?? points[0], -ref.tx, -ref.ty, -(ref.tx * ref.p1.x + ref.ty * ref.p1.y));
  }
  const faceDot = ref.nx * ref.cx + ref.ny * ref.cy;
  let made = 0;
  for (const p of points) {
    const pen = faceDot - (ref.nx * p.x + ref.ny * p.y);
    if (pen >= -1.5) {
      pushContact(out, a, b, nx, ny, Math.max(pen, 0.05), p.x, p.y);
      made++;
    }
  }
  if (!made) {
    pushContact(out, a, b, nx, ny, bestOverlap, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
}

function velocityAt(body, px, py) {
  const rx = px - body.x;
  const ry = py - body.y;
  return { x: body.vx - body.va * ry, y: body.vy + body.va * rx, rx, ry };
}

// A sleeping body is, until something wakes it, as immovable as a static
// one: solvers use these effective inverse masses so a body resting on a
// sleeping partner is stopped dead instead of sinking through it a little
// more every step (the creep that used to walk gems off their beams).
function invMassOf(b) {
  return b.isStatic || b.asleep ? 0 : b.invMass;
}
function invInertiaOf(b) {
  return b.isStatic || b.asleep ? 0 : b.invInertia;
}

function solveVelocity(c, firstPass, world) {
  const { a, b } = c;
  const va = velocityAt(a, c.px, c.py);
  const vb = velocityAt(b, c.px, c.py);
  const rvx = vb.x - va.x;
  const rvy = vb.y - va.y;
  const vn = rvx * c.nx + rvy * c.ny;

  if (firstPass && vn < 0) {
    const impact = -vn;
    if (impact > a.maxImpact) a.maxImpact = impact;
    if (impact > b.maxImpact) b.maxImpact = impact;
    if (impact > 90 && world.onImpact) world.onImpact(a, b, impact, c.px, c.py);
    if (impact > 140) {
      if (a.asleep && !b.asleep) world.wake(a);
      if (b.asleep && !a.asleep) world.wake(b);
    }
  }

  const ima = invMassOf(a);
  const imb = invMassOf(b);
  const iia = invInertiaOf(a);
  const iib = invInertiaOf(b);
  const raCn = va.rx * c.ny - va.ry * c.nx;
  const rbCn = vb.rx * c.ny - vb.ry * c.nx;
  const kn = ima + imb + iia * raCn * raCn + iib * rbCn * rbCn;
  if (kn === 0) return;
  const restitution = vn < -120 ? Math.max(a.restitution, b.restitution) : 0;
  let j = -(vn + restitution * vn) / kn; // lands vn at -restitution * vn
  const oldJn = c.jn;
  c.jn = Math.max(0, oldJn + j);
  j = c.jn - oldJn;
  applyImpulse(c, c.nx * j, c.ny * j);

  // Friction, clamped by the normal impulse.
  const va2 = velocityAt(a, c.px, c.py);
  const vb2 = velocityAt(b, c.px, c.py);
  const tx = -c.ny;
  const ty = c.nx;
  const vt = (vb2.x - va2.x) * tx + (vb2.y - va2.y) * ty;
  const raCt = va2.rx * ty - va2.ry * tx;
  const rbCt = vb2.rx * ty - vb2.ry * tx;
  const kt = ima + imb + iia * raCt * raCt + iib * rbCt * rbCt;
  if (kt === 0) return;
  let jt = -vt / kt;
  const mu = Math.sqrt(a.friction * b.friction);
  const maxFriction = mu * c.jn;
  const oldJt = c.jt;
  c.jt = Math.max(-maxFriction, Math.min(maxFriction, oldJt + jt));
  jt = c.jt - oldJt;
  applyImpulse(c, tx * jt, ty * jt);
}

function applyImpulse(c, ix, iy) {
  const { a, b } = c;
  if (!a.isStatic && !a.asleep) {
    a.vx -= ix * a.invMass;
    a.vy -= iy * a.invMass;
    a.va -= a.invInertia * ((c.px - a.x) * iy - (c.py - a.y) * ix);
  }
  if (!b.isStatic && !b.asleep) {
    b.vx += ix * b.invMass;
    b.vy += iy * b.invMass;
    b.va += b.invInertia * ((c.px - b.x) * iy - (c.py - b.y) * ix);
  }
}

function accumulatePosition(c, deltas) {
  const { a, b } = c;
  const percent = 0.6;
  const slop = 0.5;
  const ima = invMassOf(a);
  const imb = invMassOf(b);
  const invSum = ima + imb;
  if (invSum === 0) return;
  const magnitude = (Math.max(Math.min(c.pen, 12) - slop, 0) / invSum) * percent;
  addDelta(deltas, a, -c.nx * magnitude * ima, -c.ny * magnitude * ima);
  addDelta(deltas, b, c.nx * magnitude * imb, c.ny * magnitude * imb);
}

function addDelta(deltas, body, dx, dy) {
  let d = deltas.get(body);
  if (!d) {
    d = { x: 0, y: 0, n: 0 };
    deltas.set(body, d);
  }
  d.x += dx;
  d.y += dy;
  d.n += 1;
}
