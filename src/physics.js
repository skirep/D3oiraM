export const PHYSICS = Object.freeze({ speed: 7.8, gravity: 25, jump: 11.3, radius: .36, height: 1.45 });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function inside(p, platform, radius = PHYSICS.radius) {
  return Math.abs(p.x - platform.x) < platform.w / 2 + radius && Math.abs(p.z - platform.z) < platform.d / 2 + radius;
}
export function jump(player) {
  if (player.grounded || player.coyote > 0 || player.jumps < 2) {
    player.vy = PHYSICS.jump * (player.jumps === 1 ? .92 : 1);
    player.jumps = player.grounded || player.coyote > 0 ? 1 : player.jumps + 1;
    player.grounded = false; player.coyote = 0; player.platform = -1;
    return true;
  }
  return false;
}
export function createPlayer(spawn) {
  return { x: spawn[0], y: spawn[1], z: spawn[2], vx: 0, vz: 0, vy: 0, grounded: true, jumps: 0, coyote: .1, platform: 0 };
}
export function stepPlayer(p, input, platforms, dt) {
  const oldY = p.y;
  const mag = Math.hypot(input.x, input.z);
  const targetX = mag > 1 ? input.x / mag : input.x;
  const targetZ = mag > 1 ? input.z / mag : input.z;
  const damping = 1 - Math.exp(-(p.grounded ? 17 : 8) * dt);
  p.vx += (targetX * PHYSICS.speed - p.vx) * damping;
  p.vz += (targetZ * PHYSICS.speed - p.vz) * damping;
  // Transfer moving platform displacement before attempting a new landing.
  if (p.grounded && platforms[p.platform]) {
    p.x += platforms[p.platform].dx || 0;
    p.z += platforms[p.platform].dz || 0;
  }
  const moveAxis = axis => {
    p[axis] += p[axis === 'x' ? 'vx' : 'vz'] * dt;
    for (const b of platforms) {
      if (p.y >= b.y - .04 || p.y + PHYSICS.height <= b.y - 1.25) continue;
      if (!inside(p, b)) continue;
      const direction = p[axis === 'x' ? 'vx' : 'vz'];
      if (Math.abs(direction) < .001) continue;
      p[axis] = b[axis] - Math.sign(direction) * ((axis === 'x' ? b.w : b.d) / 2 + PHYSICS.radius);
      p[axis === 'x' ? 'vx' : 'vz'] = 0;
    }
  };
  moveAxis('x'); moveAxis('z');
  p.vy -= PHYSICS.gravity * dt;
  p.y += p.vy * dt;
  let landed = -1, highest = -Infinity;
  if (p.vy <= 0) {
    platforms.forEach((b, i) => {
      if (inside(p, b) && oldY >= b.y - .05 && p.y <= b.y && b.y > highest) { highest = b.y; landed = i; }
    });
  }
  if (landed >= 0) {
    p.y = highest; p.vy = 0; p.grounded = true; p.jumps = 0; p.coyote = .1; p.platform = landed;
  } else {
    if (p.grounded) p.jumps = Math.max(1, p.jumps); // walking off an edge still leaves an air jump
    p.grounded = false; p.platform = -1; p.coyote = Math.max(0, p.coyote - dt);
  }
  return landed;
}
export function platformAt(config, t, previousT = t) {
  const b = { ...config, dx: 0, dz: 0 };
  if (config.motion) {
    const { axis, range, speed } = config.motion;
    b[axis] += Math.sin(t * speed) * range;
    b[axis === 'x' ? 'dx' : 'dz'] = (Math.sin(t * speed) - Math.sin(previousT * speed)) * range;
  }
  return b;
}
