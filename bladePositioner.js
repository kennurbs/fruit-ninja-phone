// Blade positioner module: owns where the blade is and draws its stroke.
// v1 always struck through screen center; this version drives a real
// cursor from the phone's tilt (relative to wherever it was held when the
// session started) instead — this is the only file that changed for that
// swap, per the architecture split with gestureDetector.js.
function createBladePositioner(canvas) {
  const ctx = canvas.getContext('2d');
  const STROKE_MS = 220;
  const STROKE_LENGTH = 240; // px, centered on the cursor
  const TILT_RANGE_DEG = 60; // tilt (in degrees) that sweeps from center to edge
  const AIM_LOOKBACK_MS = 120; // strike uses where you were aiming just before
                                // the swing's own rotation dragged the tilt away
  const HISTORY_MS = 500;

  let cursor = { x: canvas.width / 2, y: canvas.height / 2 };
  let history = []; // { t, x, y } — recent cursor positions
  let strokes = []; // { angle, cx, cy, start }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateOrientation(beta, gamma) {
    const w = canvas.width;
    const h = canvas.height;
    cursor.x = clamp(w / 2 + (gamma / TILT_RANGE_DEG) * (w / 2), 0, w);
    cursor.y = clamp(h / 2 + (beta / TILT_RANGE_DEG) * (h / 2), 0, h);

    const now = performance.now();
    history.push({ t: now, x: cursor.x, y: cursor.y });
    while (history.length && now - history[0].t > HISTORY_MS) history.shift();
  }

  function aimPositionFor(targetTime) {
    if (history.length === 0) return cursor;
    let closest = history[0];
    for (const h of history) {
      if (Math.abs(h.t - targetTime) < Math.abs(closest.t - targetTime)) closest = h;
    }
    return closest;
  }

  const ANGLE_BY_DIRECTION = {
    '→': 0,
    '←': Math.PI,
    '↑': -Math.PI / 2,
    '↓': Math.PI / 2,
    '↗': -Math.PI / 4,
    '↘': Math.PI / 4
  };

  function endpointsFor(cx, cy, angle) {
    const dx = Math.cos(angle) * (STROKE_LENGTH / 2);
    const dy = Math.sin(angle) * (STROKE_LENGTH / 2);
    return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
  }

  function triggerStroke(direction) {
    const angle = ANGLE_BY_DIRECTION[direction] ?? 0;
    const now = performance.now();
    const { x: cx, y: cy } = aimPositionFor(now - AIM_LOOKBACK_MS);
    strokes.push({ angle, cx, cy, start: now });
    return endpointsFor(cx, cy, angle);
  }

  function render() {
    // Persistent aim indicator, so the cursor is visible even between swings.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    const now = performance.now();
    strokes = strokes.filter((s) => now - s.start < STROKE_MS);

    for (const s of strokes) {
      const t = (now - s.start) / STROKE_MS;
      const alpha = 1 - t;
      const { x1, y1, x2, y2 } = endpointsFor(s.cx, s.cy, s.angle);

      ctx.save();
      ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  return { triggerStroke, render, updateOrientation };
}
