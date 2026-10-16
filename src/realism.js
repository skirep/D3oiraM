import * as THREE from 'three';

// Deterministic PBR surface maps. No canvas or WebGL is needed to create these
// maps, so model/material validation can also run in Node.
const sets = new Map(), materials = new Map();
const size = 256;
const hash = (x, y, seed) => {
  let n = Math.imul(x + seed * 991, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295;
};
const smooth = x => x * x * (3 - 2 * x);
function noise(x, y, cells, seed) {
  const u = x * cells / size, v = y * cells / size, ix = Math.floor(u), iy = Math.floor(v), fx = smooth(u - ix), fy = smooth(v - iy);
  const h = (a,b) => hash((a + cells) % cells, (b + cells) % cells, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix,iy),h(ix+1,iy),fx),THREE.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),fx),fy);
}
function texture(data, color = false) {
  const t = new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4; t.needsUpdate = true; return t;
}
export function surfaceMaps(kind) {
  if (sets.has(kind)) return sets.get(kind);
  const height = new Float32Array(size*size), base = new Uint8Array(size*size*4), rough = new Uint8Array(size*size*4), normals = new Uint8Array(size*size*4);
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=y*size+x, grain=hash(x,y,17), broad=noise(x,y,8,3), fine=noise(x,y,32,5);
    let h=.5, value=.85;
    if(kind==='skin') {
      // Staggered micro scales; tile dimensions are integer cycles.
      const row=Math.floor(y/8), u=(x+(row%2)*4)%8/8, v=y%8/8;
      const scale=Math.pow(Math.max(0,Math.sin(u*Math.PI)*Math.sin(v*Math.PI)),.45);
      h=.32+scale*.22+fine*.17+grain*.05;value=.73+scale*.12+broad*.12;
    } else if(kind==='leaf') {
      const vein=Math.exp(-Math.abs(x-size/2)*.2);
      const branches=Math.pow(Math.max(0,Math.cos((y/size*16+(Math.abs(x-size/2)/size)*12)*Math.PI*2)),18);
      h=.4+vein*.25+branches*.1+fine*.1;value=.7+broad*.2+vein*.08;
    } else if(kind==='bark') {
      const ridge=Math.pow(Math.abs(Math.sin(x/size*Math.PI*24+broad*2)),.45);
      h=.2+ridge*.45+grain*.12;value=.55+ridge*.3+fine*.1;
    } else if(kind==='grass') {
      h=.3+fine*.35+grain*.2;value=.58+broad*.25+grain*.13;
    } else {
      const strata=Math.sin(y/size*Math.PI*18+broad*5)*.5+.5;
      h=.2+broad*.35+fine*.2+strata*.1+grain*.12;value=.6+broad*.3+grain*.1;
    }
    height[i]=h;
    const c=Math.round(value*255), r=kind==='skin'?150+Math.round(fine*70):205+Math.round(grain*45);
    base.set([c,c,c,255],i*4);rough.set([r,r,r,255],i*4);
  }
  const at=(x,y)=>height[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const n=new THREE.Vector3((at(x-1,y)-at(x+1,y))*2.4,(at(x,y-1)-at(x,y+1))*2.4,1).normalize();
    normals.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],(y*size+x)*4);
  }
  const result={map:texture(base,true),normalMap:texture(normals),roughnessMap:texture(rough)};
  sets.set(kind,result);return result;
}
export function surfaceMaterial(kind,color) {
  const key=kind+color;if(materials.has(key))return materials.get(key);
  let m;
  if(kind==='eye') m=new THREE.MeshPhysicalMaterial({color,roughness:.12,metalness:0,clearcoat:1,clearcoatRoughness:.04,ior:1.38});
  else if(kind==='mineral') m=new THREE.MeshPhysicalMaterial({color,roughness:.26,metalness:.15,clearcoat:.65,clearcoatRoughness:.12});
  else {
    const maps=surfaceMaps(kind);
    m=new THREE.MeshPhysicalMaterial({color,...maps,roughness:kind==='skin'?.72:1,normalScale:new THREE.Vector2(kind==='rock'?.7:.32,kind==='rock'?.7:.32),metalness:0,
      clearcoat:kind==='skin'?.2:kind==='leaf'?.12:0,clearcoatRoughness:.4,sheen:kind==='skin'?.16:0,sheenRoughness:.8,sheenColor:new THREE.Color('#a7b9a0')});
    if(kind==='rock' && rockAlbedo){m.map=rockAlbedo;if(rockNormal)m.normalMap=rockNormal;if(rockRoughness)m.roughnessMap=rockRoughness;}
  }
  m.name=key;materials.set(key,m);return m;
}
let rockAlbedo,rockNormal,rockRoughness;
export function loadNaturalTextures() {
  const loader=new THREE.TextureLoader();
  const load=(name,color,onLoad)=>loader.load(`${import.meta.env.BASE_URL}textures/${name}`,t=>{
    t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=4;onLoad(t);
  },undefined,()=>{ /* Keep the procedural fallback if an image cannot load. */ });
  const update=()=>{for(const [key,m] of materials)if(key.startsWith('rock')){
    if(rockAlbedo)m.map=rockAlbedo;if(rockNormal)m.normalMap=rockNormal;if(rockRoughness)m.roughnessMap=rockRoughness;m.needsUpdate=true;
  }};
  load('moss-limestone.webp',true,t=>{rockAlbedo=t;update();});
  load('moss-limestone-normal.webp',false,t=>{rockNormal=t;update();});
  load('moss-limestone-roughness.webp',false,t=>{rockRoughness=t;update();});
}
// Slightly eroded ellipsoids blend the creature's organic volumes and remove
// the sharply faceted cartoon silhouette without affecting collision volumes.
export function organicSphere() {
  const g=new THREE.SphereGeometry(1,32,24),a=g.attributes.position;
  for(let i=0;i<a.count;i++) {
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
    const d=1+.012*Math.sin(x*9+y*3)*Math.sin(z*11-y*5)*(1-y*y);
    a.setXYZ(i,x*d,y,z*d);
  }
  g.computeVertexNormals();return g;
}
export function cragGeometry() {
  // Indexed geometry works with the static batching pipeline.
  const g=new THREE.CylinderGeometry(1,.16,1,28,12),a=g.attributes.position;
  for(let i=0;i<a.count;i++) {
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i),theta=Math.atan2(z,x);
    const band=Math.sin(theta*7+y*17)*.07+Math.cos(theta*13-y*9)*.035;
    a.setXYZ(i,x*(1+band),y,z*(1+band));
  }
  g.computeVertexNormals();return g;
}

const atmospheres = new Map();
export function atmosphere(renderer, index) {
  if(atmospheres.has(index))return atmospheres.get(index);
  const w=256,h=128,data=new Float32Array(w*h*4),night=index===2;
  const top=new THREE.Color(night?'#111a32':index===1?'#8da4ae':'#849fae');
  const horizon=new THREE.Color(night?'#596078':index===1?'#ddba95':'#c8d2c8');
  const ground=new THREE.Color(night?'#152126':'#4c6050');
  const sunDir=new THREE.Vector3(-.43,.75,.43).normalize();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const phi=y/(h-1)*Math.PI,theta=x/w*Math.PI*2,up=Math.cos(phi);
    const d=new THREE.Vector3(-Math.sin(phi)*Math.cos(theta),up,Math.sin(phi)*Math.sin(theta));
    const c=up>=0?horizon.clone().lerp(top,Math.pow(up,.45)):horizon.clone().lerp(ground,Math.pow(-up,.25));
    const halo=Math.pow(Math.max(0,d.dot(sunDir)),night?80:220)*(night?.4:2.5);
    c.r+=halo;c.g+=halo*.84;c.b+=halo*.59;
    const i=(y*w+x)*4;data.set([c.r,c.g,c.b,1],i);
  }
  const sky=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  sky.mapping=THREE.EquirectangularReflectionMapping;sky.needsUpdate=true;
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromEquirectangular(sky);generator.dispose();
  const result={sky,environment:target.texture,target};atmospheres.set(index,result);return result;
}
