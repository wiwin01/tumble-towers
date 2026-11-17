// shots.js — deterministic scenes for the entry's screenshots.
//
// The game reads ?shot=start|play|end&seed=<n> and builds one frozen,
// reproducible moment of itself: the title over the first tower, a boulder
// mid-demolition on the second tower, and the level-clear panel. The
// physics is stepped a fixed number of fixed-size steps from a scripted
// slingshot pull, so the same seed renders the same picture every time.
// main.js sets window.__shotReady once the scene has been drawn.

export function setupShot(g, name, stepFixed) {
  if (name === 'start') {
    g.screen = 'title';
    g.setLevel(0);
    g.layoutButtons();
    return;
  }
  if (name === 'play') {
    g.screen = 'play';
    g.setLevel(1);
    // A scripted shot (play-tested in the physics harness): it catches the
    // left post high, and the Twin Posts tower comes down with both gems.
    g.fireBall({ x: g.anchor.x - 128, y: g.anchor.y + 58 });
    for (let i = 0; i < 132; i++) stepFixed(1 / 60);
    g.effects.splinters(g.world.bodies[6].x, g.world.bodies[6].y, '#c98d4e');
    g.effects.popup(850, 330, '+120 CHAIN x2', '#ffd94d', true);
    return;
  }
  // end: the first tower, toppled, under its level-clear panel.
  g.screen = 'play';
  g.setLevel(0);
  g.fireBall({ x: g.anchor.x - 134, y: g.anchor.y + 66 });
  for (let i = 0; i < 300; i++) stepFixed(1 / 60);
  g.levelScore = 640;
  g.bonus = 300;
  g.score = 940;
  g.screen = 'clear';
  g.layoutButtons();
}
