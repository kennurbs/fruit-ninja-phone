// Gesture detector module: consumes {x, y, z, t} accelerometer samples and
// emits "swing happened, direction X" via onSlice. Knows nothing about
// rendering — swapping in the gyro cursor later should only touch the
// blade positioner, not this file.
function createGestureDetector({ cooldownMs = 150, hysteresis = 0.85, onSlice } = {}) {
  let lastSliceT = 0;
  let armed = true;

  // Phone is held flat (Wii-remote style): X is the primary side-to-side
  // swing axis, Z reads the downward chop. Whichever axis has the largest
  // magnitude at the moment of the spike is taken as the swing direction.
  function directionFor(x, y, z) {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    if (ax >= ay && ax >= az) return x >= 0 ? '→' : '←';
    if (ay >= ax && ay >= az) return y >= 0 ? '↓' : '↑';
    return z >= 0 ? '↗' : '↘';
  }

  return function feed(sample, threshold) {
    const { x, y, z, t } = sample;
    const mag = Math.sqrt(x * x + y * y + z * z);

    if (mag >= threshold && armed && (t - lastSliceT) > cooldownMs) {
      lastSliceT = t;
      armed = false;
      if (onSlice) onSlice(directionFor(x, y, z), { x, y, z, t, mag });
    } else if (mag < threshold * hysteresis) {
      armed = true;
    }

    return mag;
  };
}
