// Blade positioner module: takes a slice direction and draws the visual
// stroke on a canvas. v1 always strokes across screen center; consuming
// orientation data to drive a real cursor position is a later swap that
// should only touch this file, not the gesture detector.
//
// Shares the canvas with the fruit field, so it does NOT clear it — the
// caller owns clearing and draw order.
function createBladePositioner(canvas) {
  const ctx = canvas.getContext('2d');
  const STROKE_MS = 220;

  const ANGLE_BY_DIRECTION = {
    '→': 0,
    '←': Math.PI,
    '↑': -Math.PI / 2,
    '↓': Math.PI / 2,
    '↗': -Math.PI / 4,
    '↘': Math.PI / 4
  };

  let strokes = []; // { angle, start }

  function endpointsForAngle(angle) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const length = Math.max(canvas.width, canvas.height) * 1.2;
    const dx = Math.cos(angle) * (length / 2);
    const dy = Math.sin(angle) * (length / 2);
    return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
  }

  function triggerStroke(direction) {
    const angle = ANGLE_BY_DIRECTION[direction] ?? 0;
    strokes.push({ angle, start: performance.now() });
    return endpointsForAngle(angle);
  }

  function render() {
    const now = performance.now();
    strokes = strokes.filter((s) => now - s.start < STROKE_MS);

    for (const s of strokes) {
      const t = (now - s.start) / STROKE_MS;
      const alpha = 1 - t;
      const { x1, y1, x2, y2 } = endpointsForAngle(s.angle);

      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  return { triggerStroke, render };
}
