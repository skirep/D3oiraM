import * as THREE from 'three';
import { surfaceMaterial, organicSphere } from './realism.js';

// Original elemental creatures. All assets are code-native geometry and shared
// physically based materials, so loading a different world never downloads another model.
const shapes = {
  round: organicSphere(),
  leaf: new THREE.SphereGeometry(1, 24, 16),
  spike: new THREE.ConeGeometry(1, 1, 8),
  gem: new THREE.OctahedronGeometry(1),
  whisker: new THREE.CylinderGeometry(.003, .001, .25, 4),
};
function part(parent, shape, color, pos, scale, kind = 'skin') {
  const m = new THREE.Mesh(shapes[shape], surfaceMaterial(shape === 'gem' ? 'mineral' : kind, color));
  m.position.set(...pos); m.scale.set(...scale); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
const round = (parent, color, pos, scale, kind) => part(parent, 'round', color, pos, scale, kind);
function pivot(parent, position) {
  const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g;
}
function face(parent, y, z, spacing, iris) {
  const eyes = [];
  for (const side of [-1, 1]) {
    const g = pivot(parent, [side * spacing, y, z]);
    // Small wet animal eyes, darker sockets and actual environment reflections.
    round(g, '#3e5145', [0, 0, -.02], [.14, .145, .065]);
    round(g, '#c4bca2', [0, 0, .017], [.105, .115, .055], 'eye');
    round(g, iris, [0, -.003, .055], [.083, .096, .04], 'eye');
    round(g, '#121d1e', [0, -.004, .085], [.028, .077, .024], 'eye');
    eyes.push(g);
  }
  return eyes;
}
function leaf(parent, color, position, scale, tilt = 0) {
  const m = part(parent, 'leaf', color, position, scale, 'leaf'); m.rotation.z = tilt; return m;
}
export function createExplorer() {
  const g = new THREE.Group(); g.name = 'Niu · wind-leaf creature';
  const body = round(g, '#6b9987', [0, .68, -.015], [.43, .49, .34]);
  round(g, '#d4cfb1', [0, .68, .285], [.29, .34, .1]);
  const head = pivot(g, [0, 1.17, 0]);
  round(head, '#83ac91', [0, 0, 0], [.47, .36, .44]);
  round(head, '#d4cfb1', [0, -.15, .32], [.28, .15, .24]);
  round(head, '#213c47', [0, -.07, .55], [.065, .045, .036]);
  round(head, '#803c4c', [0, -.22, .54], [.07, .026, .018]);
  const eyes = face(head, .035, .365, .22, '#c08032');
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = pivot(head, [s * .36, .27, -.06]); ear.rotation.z = -s * .38;
    leaf(ear, '#279b84', [0, .22, 0], [.16, .39, .1]);
    leaf(ear, '#d9ef83', [0, .24, .084], [.095, .25, .03]); ears.push(ear);
    round(head, '#638d77', [s * .34, -.1, .33], [.12, .07, .06]);
    const foot = round(g, '#277e78', [s * .24, .14, .1], [.19, .14, .26]);
    round(foot, '#ffedbb', [0, -.05, .68], [.65, .45, .35]);
    const arm = pivot(g, [s * .4, .8, 0]);
    round(arm, '#56c6a8', [s * .07, -.15, .035], [.13, .25, .14]);
    g.userData[s < 0 ? 'leftFoot' : 'rightFoot'] = foot;
    g.userData[s < 0 ? 'leftArm' : 'rightArm'] = arm;
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const whisker = new THREE.Mesh(shapes.whisker, surfaceMaterial('eye', '#bbbda5'));
      whisker.position.set(side * .32, -.12 - i * .035, .46); whisker.rotation.z = side * (1.1 + i * .12); head.add(whisker);
    }
  }
  part(head, 'gem', '#f6c763', [0, .2, .383], [.08, .12, .045]);
  // A fan of leaves is the silhouette's signature, visible while running away.
  const tail = pivot(g, [0, .46, -.29]); tail.rotation.x = -.45;
  leaf(tail, '#299982', [0, .12, -.34], [.17, .2, .49]);
  for (const s of [-1, 1]) {
    const m = leaf(tail, '#9ddd77', [s * .2, .17, -.51], [.16, .08, .37]); m.rotation.y = -s * .55;
  }
  leaf(tail, '#dcec91', [0, .2, -.66], [.17, .08, .39]);
  leaf(g, '#c4e986', [-.19, 1.02, -.27], [.13, .22, .08], -.6);
  leaf(g, '#c4e986', [.19, 1.02, -.27], [.13, .22, .08], .6);
  Object.assign(g.userData, { body, head, tail, ears, eyes, wings: [], kind: 'wind' });
  return g;
}
export function createGuardian(worldIndex) {
  const g = new THREE.Group();
  const colors = [
    { body: '#879b65', shell: '#4c6752', belly: '#cfc6a4', iris: '#a36e36' },
    { body: '#b9966b', shell: '#835d4e', belly: '#d6c9ac', iris: '#705445' },
    { body: '#9492ac', shell: '#5e617a', belly: '#c7c5ca', iris: '#5c8c90' },
  ][worldIndex];
  const body = round(g, colors.body, [0, .48, 0], [.56, .43, .51]);
  round(g, colors.belly, [0, .39, .38], [.37, .25, .15]);
  const eyes = face(g, .6, .43, .22, colors.iris);
  round(g, '#273644', [0, .43, .56], [.055, .035, .03]);
  const feet = [];
  for (const s of [-1, 1]) feet.push(round(g, colors.shell, [s * .34, .11, .12], [.21, .12, .26]));
  const ears = [], wings = [];
  const tail = pivot(g, [0, .42, -.43]);
  if (worldIndex === 0) {
    g.name = 'Brotort · seed-shell guardian';
    round(g, colors.shell, [0, .6, -.2], [.53, .43, .43], 'bark');
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const l = leaf(g, '#9ddb69', [Math.sin(a) * .23, .94, -.2 + Math.cos(a) * .23], [.14, .1, .31]);
      l.rotation.y = a;
    }
    round(g, '#f3c76c', [0, 1.06, -.2], [.13, .14, .13]);
    for (const s of [-1, 1]) ears.push(leaf(g, colors.body, [s * .48, .79, .2], [.14, .23, .11], -s * .65));
    leaf(tail, '#9ddb69', [0, .04, -.2], [.1, .09, .26]);
  } else if (worldIndex === 1) {
    g.name = 'Brasec · sunstone guardian';
    round(g, colors.shell, [0, .62, -.18], [.53, .43, .43], 'rock');
    for (let i = 0; i < 5; i++) {
      const angle = (i - 2) * .5;
      const spike = part(g, 'gem', i % 2 ? '#ffc66f' : '#ed8053', [Math.sin(angle) * .39, .91 + Math.cos(angle) * .12, -.23], [.13, .25, .13]); spike.rotation.z = -angle;
    }
    for (const s of [-1, 1]) {
      const ear = pivot(g, [s * .42, .77, .13]);
      leaf(ear, '#f2ad61', [0, .08, 0], [.16, .2, .12], -s * .6); ears.push(ear);
    }
    round(tail, colors.shell, [0, 0, -.16], [.17, .15, .27]);
    part(tail, 'gem', '#ffcf70', [0, .03, -.4], [.15, .2, .15]);
  } else {
    g.name = 'Llunalat · moonwing guardian';
    for (const s of [-1, 1]) {
      const ear = pivot(g, [s * .32, .82, -.03]); ear.rotation.z = -s * .2;
      leaf(ear, colors.shell, [0, .13, 0], [.17, .3, .12]);
      leaf(ear, '#eeaccd', [0, .14, .09], [.1, .19, .035]); ears.push(ear);
      const wing = pivot(g, [s * .4, .65, -.1]);
      leaf(wing, colors.shell, [s * .3, .04, 0], [.39, .12, .24], s * .15);
      leaf(wing, '#d0b2eb', [s * .29, .09, .015], [.29, .05, .16]); wings.push(wing);
    }
    part(g, 'gem', '#f8e29c', [0, .83, .37], [.11, .15, .05]);
    leaf(tail, colors.shell, [0, .02, -.16], [.12, .12, .27]);
    part(tail, 'gem', '#f8e29c', [0, .02, -.39], [.13, .16, .08]);
  }
  Object.assign(g.userData, { body, eyes, ears, tail, wings, feet, kind: ['seed', 'sunstone', 'moonwing'][worldIndex] });
  return g;
}
export function animateCreature(g, time, movement = 0, airborne = false) {
  const d = g.userData;
  // Blink briefly every four seconds; head/ears and tail have independent idle motion.
  const blink = (time + (d.kind === 'wind' ? 0 : .7)) % 4.3;
  d.eyes.forEach(eye => { eye.scale.y = blink > 4.12 ? .12 : 1; });
  d.ears.forEach((ear, i) => { ear.rotation.x = Math.sin(time * 2.8 + i) * .1 + (airborne ? -.2 : 0); });
  d.tail.rotation.y = Math.sin(time * (movement > .2 ? 10 : 2.8)) * .25;
  d.wings.forEach((wing, i) => { wing.rotation.z = (i ? 1 : -1) * (.12 + Math.sin(time * 7) * .22); });
  d.feet?.forEach((foot, i) => { foot.position.y = .11 + Math.max(0, Math.sin(time * 9 + i * Math.PI)) * .045; });
}
