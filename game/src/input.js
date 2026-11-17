// input.js — pointer and keyboard plumbing. It only translates browser
// events into canvas coordinates and forwards them; every decision about
// what a drag, click or key means lives in main.js.

export function attachInput(canvas, handlers) {
  const toGame = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };
  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    handlers.down(toGame(event));
  });
  canvas.addEventListener('pointermove', (event) => handlers.move(toGame(event)));
  canvas.addEventListener('pointerup', (event) => handlers.up(toGame(event)));
  canvas.addEventListener('pointercancel', () => handlers.up(null));
  window.addEventListener('keydown', (event) => handlers.key(event.key));
}
