// levels.js — the five towers of the Wobble Kingdom, described as data.
//
// Each level is a list of blocks standing on the stone pedestal. A block is
// { mat, x, y, w, h, angle? } where x and y are offsets from the pedestal's
// top-centre, so the same tower reads the same at any canvas size. "gem"
// blocks are the Star Sprite cages: knock a gem off the pedestal and onto
// the grass and it is freed. Wood is light, stone is heavy and stubborn,
// glass is fragile and shatters for bonus points and chain reactions.

export const MATERIALS = {
  wood: { density: 0.0016, friction: 0.6, restitution: 0.04, fill: '#c98d4e', edge: '#8a5a28', score: 40 },
  stone: { density: 0.0042, friction: 0.75, restitution: 0.02, fill: '#9aa3ad', edge: '#5f6871', score: 60 },
  glass: { density: 0.0011, friction: 0.42, restitution: 0.08, fill: '#bfe8ef', edge: '#6fb3c4', score: 90, fragile: true },
  gem: { density: 0.0013, friction: 0.5, restitution: 0.1, fill: '#ffd94d', edge: '#d99a16', score: 0 },
};

const B = (mat, x, y, w, h, angle) => ({ mat, x, y, w, h, angle: angle ?? 0 });

export const LEVELS = [
  {
    name: 'First Wobble',
    balls: 3,
    par: 400,
    blocks: [
      B('wood', -46, -30, 26, 60), B('wood', 46, -30, 26, 60),
      B('wood', 0, -72, 150, 24),
      B('gem', 0, -106, 44, 44),
    ],
  },
  {
    name: 'Twin Posts',
    balls: 3,
    par: 700,
    blocks: [
      B('wood', -120, -30, 26, 60), B('wood', -64, -30, 26, 60),
      B('wood', -92, -72, 130, 24),
      B('gem', -92, -104, 40, 40),
      B('stone', 96, -26, 30, 52), B('wood', 96, -63, 110, 22),
      B('gem', 96, -94, 40, 40),
      B('glass', 0, -16, 34, 32),
    ],
  },
  {
    name: 'The Long Bridge',
    balls: 4,
    par: 900,
    blocks: [
      B('stone', -150, -30, 30, 60), B('stone', 150, -30, 30, 60),
      B('wood', -84, -30, 24, 60), B('wood', 84, -30, 24, 60),
      B('wood', 0, -71, 340, 22),
      B('gem', -120, -102, 40, 40), B('gem', 120, -102, 40, 40),
      B('glass', 0, -99, 30, 34),
      B('wood', 0, -126, 90, 20),
    ],
  },
  {
    name: 'Castle Wobble',
    balls: 4,
    par: 1300,
    blocks: [
      B('stone', -170, -32, 34, 64), B('stone', 170, -32, 34, 64),
      B('wood', -104, -32, 26, 64), B('wood', 104, -32, 26, 64),
      B('wood', 0, -76, 380, 24),
      B('wood', -120, -118, 24, 60), B('wood', 120, -118, 24, 60),
      B('glass', 0, -118, 36, 60),
      B('wood', 0, -159, 300, 22),
      B('gem', -120, -190, 40, 40), B('gem', 120, -190, 40, 40),
      B('wood', 0, -200, 30, 60),
      B('wood', 0, -240, 84, 20),
      B('gem', 0, -272, 44, 44),
    ],
  },
  {
    name: 'The Wobble Crown',
    balls: 5,
    par: 1800,
    blocks: [
      B('stone', -180, -30, 32, 60), B('stone', -60, -30, 32, 60),
      B('stone', 60, -30, 32, 60), B('stone', 180, -30, 32, 60),
      B('wood', 0, -71, 430, 22),
      B('wood', -185, -103, 24, 42), B('glass', -120, -103, 34, 42),
      B('glass', 120, -103, 34, 42), B('wood', 185, -103, 24, 42),
      B('gem', 0, -102, 40, 40),
      B('wood', 0, -135, 430, 22),
      B('gem', -165, -166, 40, 40), B('gem', 165, -166, 40, 40),
      B('wood', -60, -176, 24, 60), B('wood', 60, -176, 24, 60),
      B('stone', 0, -218, 150, 24),
      B('wood', 0, -240, 70, 20),
      B('gem', 0, -271, 42, 42),
    ],
  },
];

export function gemCount(level) {
  return level.blocks.filter((b) => b.mat === 'gem').length;
}
