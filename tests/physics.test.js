import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, jump, stepPlayer, platformAt, PHYSICS } from '../src/physics.js';
import { LEVELS, coinPositions } from '../src/levels.js';
const base = { x: 0, y: 0, z: 0, w: 20, d: 20 };
const dt = 1 / 120;
test('a grounded jump lands on the same platform and resets the air jump', () => {
  const p = createPlayer([0, 0, 0]); assert.ok(jump(p));
  let peak = 0;
  for (let i = 0; i < 180; i++) { stepPlayer(p, { x: 0, z: 0 }, [base], dt); peak = Math.max(peak, p.y); }
  assert.ok(peak > 2.4 && peak < 2.7); assert.equal(p.y, 0); assert.equal(p.grounded, true); assert.equal(p.jumps, 0);
});
test('double jump is allowed exactly once before landing', () => {
  const p = createPlayer([0,0,0]); jump(p);
  for (let i = 0; i < 45; i++) stepPlayer(p, {x:0,z:0}, [base], dt);
  assert.ok(jump(p)); assert.equal(p.jumps,2); assert.equal(jump(p),false);
  for (let i=0;i<240;i++) stepPlayer(p,{x:0,z:0},[base],dt);
  assert.equal(p.grounded,true); assert.ok(jump(p));
});
test('horizontal motion does not teleport onto a platform from below', () => {
  const p=createPlayer([-4,0,0]); const raised={x:0,y:2,z:0,w:3,d:3};
  for(let i=0;i<100;i++) stepPlayer(p,{x:1,z:0},[base,raised],dt);
  assert.equal(p.y,0); assert.ok(p.x < -1.8);
});
test('moving platform carries the player', () => {
  const b={...base,motion:{axis:'x',range:2,speed:1}},p=createPlayer([0,0,0]);
  for(let i=1;i<=120;i++) stepPlayer(p,{x:0,z:0},[platformAt(b,i*dt,(i-1)*dt)],dt);
  assert.ok(Math.abs(p.x-2*Math.sin(1))<.01); assert.equal(p.grounded,true);
});
test('walking off an edge leaves one air jump and eventually falls', () => {
  const p=createPlayer([0,0,0]);
  for(let i=0;i<120;i++) stepPlayer(p,{x:1,z:0},[{...base,w:2,d:2}],dt);
  assert.equal(p.grounded,false); assert.equal(p.jumps,1); assert.ok(p.y < -1); assert.ok(jump(p)); assert.equal(jump(p),false);
});
test('all three routes can be completed with timed double jumps', () => {
  for(const l of LEVELS) {
    for(let j=1;j<l.islands.length;j++) {
      const a=l.islands[j-1],b=l.islands[j];
      // Test each possible motion extreme. Launch from inside the departure edge.
      for(const t of [0,2,5]) {
        const target=platformAt(b,t),start=platformAt(a,t);
        const dx=target.x-start.x,dz=target.z-start.z,dist=Math.hypot(dx,dz),ux=dx/dist,uz=dz/dist;
        const edge=Math.min((start.w/2-.7)/(Math.abs(ux)||.001),(start.d/2-.7)/(Math.abs(uz)||.001));
        const p=createPlayer([start.x+ux*edge,start.y,start.z+uz*edge]);
        p.vx=ux*PHYSICS.speed;p.vz=uz*PHYSICS.speed;jump(p);let landed=false;
        for(let frame=0;frame<220;frame++) {
          if(frame===48) jump(p);
          const remaining=Math.hypot(target.x-p.x,target.z-p.z);
          stepPlayer(p,{x:remaining>.6?(target.x-p.x)/remaining:0,z:remaining>.6?(target.z-p.z)/remaining:0},[start,target],dt);
          if(p.grounded && p.platform===1) {landed=true;break;}
        }
        assert.ok(landed,`${l.name.en} gap ${j-1}→${j} at phase ${t} is unreachable`);
      }
    }
    assert.equal(l.shards.length,3); assert.equal(coinPositions(l).length,36);
    assert.ok(l.islands[l.checkpoint]);
    for(const [x,y,z] of [...l.shards,l.goal]) assert.ok(l.islands.some(b=>Math.abs(x-b.x)<b.w/2 && Math.abs(z-b.z)<b.d/2 && y>=b.y));
  }
});
