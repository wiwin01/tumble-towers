// Tumble Towers — hand-in program for make.fun's best-game-01.
//
// The game itself is the static site under game/ (open game/index.html in a
// browser; it needs no build step and no network). This program's one job is
// to hand that game in the way the bounty asks: copy game/ and screenshots/
// into the output directory, then write dossier.json with the kit's own
// buildDossier library so the sealed scorer can rebuild it byte for byte and
// compare. Outside the grader, MAKEFUN_OUTPUT_DIR names the output directory:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, mirrored so this program refuses early anything the
// scorer would refuse: the dossier text cap shapes the bytes written, the
// rest are the limits on screenshots and on the game tree itself.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, DOSSIER_CAPS));

// Verify what was just handed in, so a broken entry fails here — loudly,
// before submission — instead of at the sealed scorer. The dossier must sit
// under its 1.5 MiB cap, the game tree must be non-empty, and the entry must
// carry its 3 or 4 screenshots; then say in one line what was handed in.
const dossierBytes = statSync(join(outputDir, 'dossier.json')).size;
if (dossierBytes > 1572864) {
  throw new Error(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
}
const countTree = (dir) => readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? countTree(join(dir, e.name)) : 1), 0);
const gameFiles = countTree(join(outputDir, 'game'));
if (gameFiles === 0) throw new Error('game/ handed in empty');
const shots = existsSync(join(outputDir, 'screenshots'))
  ? readdirSync(join(outputDir, 'screenshots')).filter((f) => !f.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ holds ${shots.length} images; the bounty wants 3 or 4`);
}
console.log(`Tumble Towers handed in: ${gameFiles} game files, ${shots.length} screenshots, dossier ${dossierBytes} bytes.`);
