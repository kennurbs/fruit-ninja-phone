// Fruit field module: spawns fruit (and the occasional bomb) with
// gravity, checks a line segment (the blade stroke) against each for a
// slice, and owns the splatter/combo/explosion/lives juice that comes
// from a hit or a miss. Rendering-only — the caller owns clearing the
// canvas and draw order.
function createFruitField(canvas) {
  const ctx = canvas.getContext('2d');
  const GRAVITY = 900;              // px/s^2
  const SPAWN_INTERVAL_MS = 1100;
  const BOMB_CHANCE = 0.18;
  const COMBO_WINDOW_MS = 1000;     // gap allowed between hits to keep a combo alive
  const PARTICLE_LIFETIME_MS = 500;
  const POPUP_LIFETIME_MS = 700;
  const FLASH_MS = 200;
  const STARTING_LIVES = 3;

  const FRUIT_KINDS = [
    { name: 'watermelon', rind: '#2f8f3e', flesh: '#e0453e', seeds: true },
    { name: 'lime', rind: '#6fae2e', flesh: '#c9e77a', seeds: true },
    { name: 'apple', body: ['#ff7a5c', '#c0392b'], highlight: true, stem: true },
    { name: 'orange', body: ['#ffc266', '#e8850c'], highlight: true }
  ];
  const EXPLOSION_COLORS = ['#ff4444', '#ff8800', '#ffcc00', '#555555'];

  let objects = [];   // { x, y, vx, vy, w, h, type: 'fruit'|'bomb', kind, color, seedOffset, alive }
  let particles = []; // { x, y, vx, vy, color, size, start }
  let popups = [];    // { text, x, y, start }
  let score = 0;
  let combo = 0;
  let lives = STARTING_LIVES;
  let gameOver = false;
  let lastHitTime = -Infinity;
  let lastSpawn = 0;
  let lastFrameTime = null;
  let flashUntil = 0;
  let paused = false;

  function spawnObject() {
    const w = canvas.width;
    const h = canvas.height;
    const size = 50 + Math.random() * 30;
    const isBomb = Math.random() < BOMB_CHANCE;
    const kind = FRUIT_KINDS[Math.floor(Math.random() * FRUIT_KINDS.length)];
    objects.push({
      x: 60 + Math.random() * (w - 120),
      y: h + size,
      vx: (Math.random() - 0.5) * 120,
      vy: -(700 + Math.random() * 250),
      w: size,
      h: size,
      type: isBomb ? 'bomb' : 'fruit',
      kind,
      color: isBomb ? '#1a1a1a' : (kind.flesh || kind.body[0]),
      seedOffset: Math.random() * Math.PI * 2,
      alive: true
    });
  }

  function spawnSplatter(o) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 150 + Math.random() * 200;
      particles.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: o.color,
        size: 4 + Math.random() * 4,
        start: performance.now()
      });
    }
  }

  function spawnExplosion(o) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 300;
      particles.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)],
        size: 5 + Math.random() * 6,
        start: performance.now()
      });
    }
  }

  function spawnPopup(text, x, y, tone) {
    popups.push({ text, x, y, start: performance.now(), tone: tone || 'combo' });
  }

  function loseLife() {
    if (gameOver) return;
    lives = Math.max(0, lives - 1);
    combo = 0;
    if (lives === 0) {
      gameOver = true;
      paused = true;
    }
  }

  function update(now) {
    if (paused) return;

    if (lastFrameTime === null) lastFrameTime = now;
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (now - lastSpawn > SPAWN_INTERVAL_MS) {
      lastSpawn = now;
      spawnObject();
    }

    for (const o of objects) {
      o.vy += GRAVITY * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
    }

    const kept = [];
    for (const o of objects) {
      if (!o.alive) continue;
      const offBottom = o.y - o.h / 2 >= canvas.height + 100;
      if (offBottom) {
        if (o.type === 'fruit') loseLife();
        continue;
      }
      kept.push(o);
    }
    objects = kept;

    for (const p of particles) {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    const nowPerf = performance.now();
    particles = particles.filter((p) => nowPerf - p.start < PARTICLE_LIFETIME_MS);
    popups = popups.filter((p) => nowPerf - p.start < POPUP_LIFETIME_MS);

    if (combo > 0 && nowPerf - lastHitTime > COMBO_WINDOW_MS) {
      combo = 0;
    }
  }

  function drawBomb(o) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.w / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - o.h / 2);
    ctx.quadraticCurveTo(o.x + 10, o.y - o.h / 2 - 14, o.x + 4, o.y - o.h / 2 - 22);
    ctx.stroke();

    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.arc(o.x + 4, o.y - o.h / 2 - 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFruit(o) {
    const r = o.w / 2;
    const kind = o.kind;
    ctx.save();
    ctx.translate(o.x, o.y);

    if (kind.rind) {
      ctx.fillStyle = kind.rind;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = kind.flesh;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
      ctx.fill();

      if (kind.seeds) {
        ctx.fillStyle = 'rgba(25, 20, 15, 0.85)';
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5 + o.seedOffset;
          const sx = Math.cos(a) * r * 0.42;
          const sy = Math.sin(a) * r * 0.42;
          ctx.beginPath();
          ctx.ellipse(sx, sy, 2.2, 3.6, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      grad.addColorStop(0, kind.body[0]);
      grad.addColorStop(1, kind.body[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      if (kind.highlight) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (kind.stem) {
        ctx.strokeStyle = '#5a3820';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(2, -r - 8);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function render() {
    for (const o of objects) {
      if (o.type === 'bomb') {
        drawBomb(o);
      } else {
        drawFruit(o);
      }
    }

    const now = performance.now();

    for (const p of particles) {
      const t = (now - p.start) / PARTICLE_LIFETIME_MS;
      ctx.fillStyle = hexToRgba(p.color, 1 - t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px Georgia, serif';
    for (const p of popups) {
      const t = (now - p.start) / POPUP_LIFETIME_MS;
      const alpha = 1 - t;
      const riseY = p.y - t * 30;
      const textWidth = ctx.measureText(p.text).width;
      const bw = textWidth + 28;
      const bh = 34;

      ctx.fillStyle = `rgba(120, 15, 15, ${0.8 * alpha})`;
      roundRect(p.x - bw / 2, riseY - bh / 2, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 220, 160, ${0.7 * alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 235, 190, ${alpha})`;
      ctx.fillText(p.text, p.x, riseY + 1);
    }
    ctx.textBaseline = 'alphabetic';

    if (now < flashUntil) {
      const alpha = 0.5 * ((flashUntil - now) / FLASH_MS);
      ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Liang-Barsky segment-vs-AABB clip test
  function segmentHitsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    const left = rx - rw / 2, right = rx + rw / 2;
    const top = ry - rh / 2, bottom = ry + rh / 2;
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = 0, t1 = 1;

    function clip(p, q) {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    }

    return (
      clip(-dx, x1 - left) &&
      clip(dx, right - x1) &&
      clip(-dy, y1 - top) &&
      clip(dy, bottom - y1) &&
      t0 <= t1
    );
  }

  function sliceCheck(x1, y1, x2, y2) {
    if (paused) return { hits: 0, bombHit: false };

    const sliced = [];
    for (const o of objects) {
      if (o.alive && segmentHitsRect(x1, y1, x2, y2, o.x, o.y, o.w, o.h)) {
        o.alive = false;
        sliced.push(o);
      }
    }
    if (sliced.length === 0) return { hits: 0, bombHit: false };

    objects = objects.filter((o) => o.alive);

    const bomb = sliced.find((o) => o.type === 'bomb');
    if (bomb) {
      spawnExplosion(bomb);
      flashUntil = performance.now() + FLASH_MS;
      loseLife();
      return { hits: 0, bombHit: true };
    }

    score += sliced.length;
    combo++;
    lastHitTime = performance.now();

    for (const f of sliced) spawnSplatter(f);

    const midX = sliced.reduce((s, f) => s + f.x, 0) / sliced.length;
    const midY = sliced.reduce((s, f) => s + f.y, 0) / sliced.length;
    if (sliced.length > 1) spawnPopup(`x${sliced.length}!`, midX, midY);
    if (combo > 1) spawnPopup(`${combo} COMBO`, midX, midY - 32);

    return { hits: sliced.length, bombHit: false };
  }

  function reset() {
    objects = [];
    particles = [];
    popups = [];
    score = 0;
    combo = 0;
    lives = STARTING_LIVES;
    gameOver = false;
    lastHitTime = -Infinity;
    lastSpawn = 0;
    lastFrameTime = null;
    flashUntil = 0;
    paused = false;
  }

  return {
    update,
    render,
    sliceCheck,
    reset,
    getScore: () => score,
    getCombo: () => combo,
    getLives: () => lives,
    isGameOver: () => gameOver
  };
}
