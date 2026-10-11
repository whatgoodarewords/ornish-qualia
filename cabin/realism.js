/* Photographic surfaces for the existing interactive cabin. No scene replacement. */
(() => {
  'use strict';
  const api = window.__cabinRendering;
  if (!api) return;
  const T = api.THREE, scene = api.scene, M = api.materials;
  const manifest = Object.freeze({
    timber: './assets/timber.webp', linen: './assets/linen.webp',
    stone: './assets/stone.webp', bark: './assets/bark.webp',
    ground: './assets/ground.webp', foliage: './assets/foliage.webp',
    moss: './assets/moss.webp', fern: './assets/fern.webp'
  });
  const assets = {}, textures = {}, bumps = {}, families = new Map(), processed = new WeakSet();
  const originals = new Map(), originalTimberMap = M.timber.map;
  const counts = {mappedMeshes: 0, roundedFurniture: 0, nearCrowns: 0, distantCrowns: 0, foliageCards: 0, boulders: 0, ferns: 0};
  let status = 'loading', installed = false, night = 0;
  const replacementCrowns = [];
  const detailGroup = new T.Group();
  detailGroup.name = 'Woodland rocks and ferns';
  api.forest.add(detailGroup);

  function notice(message) {
    let el = document.getElementById('surfaceStatus');
    if (!message) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'surfaceStatus';
      el.setAttribute('role', 'status');
      Object.assign(el.style, {position:'fixed', bottom:'16px', right:'16px', maxWidth:'290px',
        padding:'9px 12px', borderRadius:'5px', background:'var(--panel)', color:'var(--ink)',
        font:'12px/1.4 "DM Sans",sans-serif', zIndex:'8'});
      document.body.appendChild(el);
    }
    el.textContent = message;
  }

  function snapshot() {
    return {
      version: 1, status, assets: Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,{...v}])),
      ...counts, materialFamilies: Object.fromEntries([...families].reduce((out,[,f])=>out.set(f,(out.get(f)||0)+1),new Map())),
      lighting: {night, exposure:api.renderer.toneMappingExposure, environment:scene.environmentIntensity,
        sun:api.lights.sun.intensity, hemisphere:api.lights.hemisphere.intensity, ambient:api.lights.ambient.intensity},
      glass: {transmission:M.glass.transmission, ior:M.glass.ior, roughness:M.glass.roughness},
      forestVisible: api.forest.visible,
      fallbackActive: Object.values(assets).some(a=>a.state==='failed')
    };
  }

  function load(name, url) {
    assets[name] = {url, state:'loading'};
    return new Promise(resolve => {
      const image = new Image();
      let finished = false;
      const finish = (error) => {
        if (finished) return; finished = true; clearTimeout(timer);
        if (error) {assets[name].state='failed'; assets[name].error=error; resolve(null); return;}
        try {
          if (name==='foliage' || name==='fern') {
            const c=document.createElement('canvas'); c.width=c.height=48;
            const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(image,0,0,48,48);
            const rgba=ctx.getImageData(0,0,48,48).data;
            let transparent=0; for(let i=3;i<rgba.length;i+=4) if(rgba[i]<128) transparent++;
            assets[name].transparentFraction=transparent/(48*48);
            if (transparent<24 || transparent>48*48-24) throw new Error('Missing usable transparency');
          }
          const texture = new T.Texture(image);
          texture.colorSpace=T.SRGBColorSpace;
          texture.wrapS=texture.wrapT=T.RepeatWrapping;
          texture.anisotropy=Math.min(8,api.renderer.capabilities.getMaxAnisotropy());
          texture.needsUpdate=true; texture.name='cabin-'+name;
          textures[name]=texture;
          Object.assign(assets[name],{state:'loaded',width:image.naturalWidth,height:image.naturalHeight});
          resolve(texture);
        } catch (e) {assets[name].state='failed';assets[name].error=e.message;resolve(null);}
      };
      const timer=setTimeout(()=>finish('Texture request timed out'),20000);
      image.onload=()=>finish(); image.onerror=()=>finish('Texture could not load'); image.src=url;
    });
  }

  const named = {
    timber:'timber', timberDark:'timber', linen:'linen', wool:'linen', oatmeal:'linen',
    moss:'linen', clay:'linen', mattress:'linen', blackFabric:'linen', blackout:'linen',
    ground:'ground', soil:'stone', gravel:'stone', trunk:'bark', branch:'bark'
  };
  Object.entries(named).forEach(([name,family])=>families.set(M[name],family));
  // Garden-office surfaces use their own materials with the shared timber image.
  scene.traverse(o=>{
    if(!o.isMesh) return;
    for(const m of Array.isArray(o.material)?o.material:[o.material]) {
      if(!m) continue;
      if(m.map===originalTimberMap || m.name==='Oiled oak butcher block') families.set(m,'timber');
      if(m.color && m.color.getHex()===7501413 && o.parent) families.set(m,'linen');
    }
  });

  function roundedBox(width,height,depth,radius) {
    const geometry=new T.BoxGeometry(width,height,depth,4,4,4);
    const p=geometry.attributes.position, n=geometry.attributes.normal;
    const inner=new T.Vector3(width/2-radius,height/2-radius,depth/2-radius);
    const v=new T.Vector3(), center=new T.Vector3(), normal=new T.Vector3();
    for(let i=0;i<p.count;i++) {
      v.fromBufferAttribute(p,i);
      center.set(Math.max(-inner.x,Math.min(inner.x,v.x)),Math.max(-inner.y,Math.min(inner.y,v.y)),Math.max(-inner.z,Math.min(inner.z,v.z)));
      normal.copy(v).sub(center).normalize(); v.copy(center).addScaledVector(normal,radius);
      p.setXYZ(i,v.x,v.y,v.z); n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }

  // Position-based projection gives every face a scale in metres. It also supplies
  // UVs to hand-built prisms. Timber grain follows each member's longest dimension.
  function metricUV(mesh,family) {
    let g=mesh.geometry;
    if(!g?.attributes.position) return;
    if(family==='linen' && g.type==='BoxGeometry') {
      const p=g.parameters;
      if(Math.min(p.width,p.height,p.depth)>.045 && Math.max(p.width,p.height,p.depth)<3) {
        g=roundedBox(p.width,p.height,p.depth,Math.min(.055,Math.min(p.width,p.height,p.depth)*.23));
        mesh.geometry=g; counts.roundedFurniture++;
      }
    }
    // Shared geometry may belong to another material; keep that object's UVs intact.
    g=g.clone(); mesh.geometry=g;
    const p=g.attributes.position;
    if(!g.attributes.normal) g.computeVertexNormals();
    const normals=g.attributes.normal;
    g.computeBoundingBox();
    const size=g.boundingBox.getSize(new T.Vector3());
    const dims=[size.x,size.y,size.z];
    // Cabin/deck board joints are already modelled along Z, even where the
    // complete floor slab is wider than it is deep.
    const longest=family==='timber' && size.y<.26 && size.x>2.5 && size.z>1.5 ? 2 : dims.indexOf(Math.max(...dims));
    const uv=new Float32Array(p.count*2), scale={timber:1,linen:5,stone:.85,bark:1.5,ground:.3}[family]||1;
    const offset=(mesh.id*0.61803398875)%1;
    const cylinder=family==='bark' && g.type==='CylinderGeometry' && g.attributes.uv;
    for(let i=0;i<p.count;i++) {
      if(cylinder) {
        const radius=Math.max(g.parameters.radiusTop,g.parameters.radiusBottom);
        uv[i*2]=g.attributes.uv.getX(i)*2*Math.PI*radius*scale;
        uv[i*2+1]=g.attributes.uv.getY(i)*g.parameters.height*scale;
        continue;
      }
      const pos=[p.getX(i),p.getY(i),p.getZ(i)], norm=[Math.abs(normals.getX(i)),Math.abs(normals.getY(i)),Math.abs(normals.getZ(i))];
      const face=norm.indexOf(Math.max(...norm)), axes=[0,1,2].filter(a=>a!==face);
      let a=axes[0],b=axes[1];
      if(family==='timber') {
        // Source photograph has vertical grain. V follows the long axis.
        b=axes.includes(longest)?longest:axes.reduce((x,y)=>dims[x]>dims[y]?x:y);
        a=axes.find(x=>x!==b);
      }
      uv[i*2]=pos[a]*scale+offset; uv[i*2+1]=pos[b]*scale+offset*.71;
    }
    g.setAttribute('uv',new T.BufferAttribute(uv,2));
    mesh.userData.realismUV={family,metres:true}; counts.mappedMeshes++;
  }

  function configureMaterial(m,family) {
    const map=textures[family]; if(!map) return;
    m.userData.cabinSurface=family;
    if(!originals.has(m)) originals.set(m,{color:m.color.clone(),map:m.map,bumpMap:m.bumpMap});
    m.map=map;
    const bump=bumps[family] || map.clone(); bump.colorSpace=T.NoColorSpace; bump.needsUpdate=true; bumps[family]=bump;
    m.bumpMap=bump;
    m.bumpScale={timber:.006,linen:.0022,stone:.018,bark:.028,ground:.035}[family];
    m.roughness={timber:.63,linen:.98,stone:.9,bark:.97,ground:1}[family];
    m.metalness=0;
    if(family==='timber') m.color.copy(originals.get(m).color).lerp(new T.Color('#ffffff'),m===M.timberDark?.36:.8);
    else if(family==='linen') m.color.copy(originals.get(m).color).lerp(new T.Color('#ffffff'),m===M.mattress?.88:.34);
    else m.color.set('#ffffff');
    if(family==='bark') {
      // Distant trees are instanced: their unit trunk is stretched to its real
      // height by the instance matrix, so scale both texture UVs accordingly.
      m.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
          #ifdef USE_INSTANCING
            #ifdef USE_MAP
              vMapUv.y *= length(instanceMatrix[1].xyz);
            #endif
            #ifdef USE_BUMPMAP
              vBumpMapUv.y *= length(instanceMatrix[1].xyz);
            #endif
          #endif`);
      };
      m.customProgramCacheKey=()=> 'cabin-bark-metric-v1';
    }
    m.needsUpdate=true;
  }

  function refresh() {
    if(!installed) return;
    scene.traverse(mesh=>{
      if(!mesh.isMesh || processed.has(mesh)) return;
      const material=Array.isArray(mesh.material)?null:mesh.material;
      let family=families.get(material);
      if(!family && material) {
        family=material.userData.cabinSurface || ((material.map===originalTimberMap || material.map===textures.timber)?'timber':null);
        if(family) {families.set(material,family); configureMaterial(material,family);}
      }
      if(family && textures[family]) {metricUV(mesh,family);processed.add(mesh);}
    });
    for(const {source,replacement} of replacementCrowns) {
      replacement.visible=source.visible; source.material.visible=false;
    }
    detailGroup.visible=window.__cabin.state.view!=='pod-site';
    api.markShadows();
  }

  function foliageMaterial(texture) {
    return new T.MeshStandardMaterial({map:texture,color:'#c3c9a9',roughness:.95,
      side:T.DoubleSide,alphaTest:.38,transparent:false,depthWrite:true});
  }
  let seed=876512;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const random=(a,b)=>a+(b-a)*rand();

  function replaceFoliage() {
    if(!textures.foliage) return;
    const material=foliageMaterial(textures.foliage), sources=[];
    api.forest.traverse(o=>{
      if(o.isMesh && (o.material===M.canopy || (o.isInstancedMesh && o.material?.vertexColors && o!==api.terrain))) sources.push(o);
    });
    const matrix=new T.Matrix4(), pos=new T.Vector3(), scale=new T.Vector3(), q=new T.Quaternion();
    for(const source of sources) {
      source.geometry.computeBoundingBox();
      const bounds=source.geometry.boundingBox, center=bounds.getCenter(new T.Vector3()), size=bounds.getSize(new T.Vector3());
      if(source.isInstancedMesh) {
        const planes=[];
        for(let i=0;i<22;i++) {
          const plane=new T.PlaneGeometry(random(1.1,1.8),random(.8,1.4));
          plane.rotateY(random(0,Math.PI*2)); plane.rotateX(random(-.65,.65));
          plane.translate(center.x+random(-size.x*.4,size.x*.4),center.y+random(-size.y*.45,size.y*.45),center.z+random(-size.z*.4,size.z*.4));
          planes.push(plane);
        }
        const geometry=api.mergeGeometries(planes,false); planes.forEach(p=>p.dispose());
        const replacement=new T.InstancedMesh(geometry,material,source.count);
        replacement.instanceMatrix.copy(source.instanceMatrix); replacement.instanceMatrix.needsUpdate=true;
        for(let i=0;i<source.count;i++) replacement.setColorAt(i,new T.Color().setHSL(random(.2,.27),random(.08,.18),random(.72,.93)));
        replacement.position.copy(source.position); replacement.quaternion.copy(source.quaternion);replacement.scale.copy(source.scale);
        replacement.frustumCulled=false; replacement.receiveShadow=true;
        replacement.name='Photographic distant woodland canopy'; source.parent.add(replacement);
        replacementCrowns.push({source,replacement});counts.distantCrowns+=source.count;counts.foliageCards+=source.count*22;
      } else {
        const count=52;
        const replacement=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,count);
        for(let i=0;i<count;i++) {
          const angle=random(0,Math.PI*2), radius=Math.sqrt(rand());
          pos.set(center.x+Math.cos(angle)*radius*size.x*.49,center.y+random(-.45,.5)*size.y,center.z+Math.sin(angle)*radius*size.z*.49);
          scale.set(random(.8,1.7),random(.7,1.25),1);
          q.setFromEuler(new T.Euler(random(-.8,.8),random(0,Math.PI*2),random(-.3,.3)));
          matrix.compose(pos,q,scale); replacement.setMatrixAt(i,matrix);
          replacement.setColorAt(i,new T.Color().setHSL(random(.19,.26),random(.05,.15),random(.7,.94)));
        }
        replacement.position.copy(source.position);replacement.quaternion.copy(source.quaternion);replacement.scale.copy(source.scale);
        replacement.castShadow=true;replacement.receiveShadow=true;replacement.frustumCulled=false;
        replacement.name='Photographic near woodland canopy';source.parent.add(replacement);
        replacementCrowns.push({source,replacement});counts.nearCrowns++;counts.foliageCards+=count;
      }
    }
  }

  function addWoodlandDetails() {
    // These positions stay outside the cabin, office and access footprints.
    const rocks=[[-5.3,5.5,1.5],[5.1,4.9,1.55],[4.1,7.1,1.25],[-4.1,8.1,1.15],[-6.1,6.5,1.18],[-7.2,7.5,.82],[6.7,6.4,1.05],[7.5,7.6,.7],[4.7,9.8,.9],[-4.9,10.4,.75],[-1.6,11.8,1.1],[2.8,9.5,.8],[-6.9,-5.8,.8]];
    if(textures.moss) {
      const material=new T.MeshStandardMaterial({map:textures.moss,roughness:1,color:'#c7cbb8'});
      const bump=textures.moss.clone(); bump.colorSpace=T.NoColorSpace;bump.needsUpdate=true;
      material.bumpMap=bump;material.bumpScale=.06;
      for(const [x,z,r] of rocks) {
        const geometry=new T.IcosahedronGeometry(r,3), p=geometry.attributes.position;
        for(let i=0;i<p.count;i++) {
          const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);
          // Position-derived displacement keeps duplicate edge vertices together.
          const wave=1+.09*Math.sin(px*3.7+py*4.2)*Math.cos(pz*3.1-py*1.8);
          p.setXYZ(i,px*wave,py*wave*.64,pz*wave*.85);
        }
        geometry.computeVertexNormals();
        const rock=new T.Mesh(geometry,material);rock.position.set(x,api.terrainY(x,z)+r*.28,z);rock.rotation.y=random(0,Math.PI*2);
        rock.name='Moss granite boulder';rock.castShadow=rock.receiveShadow=true;detailGroup.add(rock);
        metricUV(rock,'stone'); processed.add(rock);counts.boulders++;
      }
    }
    if(textures.fern) {
      const material=foliageMaterial(textures.fern);material.color.set('#e0e1c5');
      for(const [x,z,r] of rocks) for(let i=0;i<3;i++) {
        const angle=i*Math.PI*2/3+.4,fx=x+Math.cos(angle)*(r+.45),fz=z+Math.sin(angle)*(r+.45),h=random(.65,1.1);
        if((fx>-7.5 && fx<6.6 && fz>-5.2 && fz<4.2) || (Math.abs(fx)<3.9 && fz>2 && fz<7.7)) continue;
        const fern=new T.Group();fern.name='Woodland fern';fern.position.set(fx,api.terrainY(fx,fz),fz);detailGroup.add(fern);
        for(let j=0;j<3;j++) {
          const mesh=new T.Mesh(new T.PlaneGeometry(h*1.3,h),material);mesh.position.y=h*.46;mesh.rotation.y=j*Math.PI/3+angle;
          mesh.castShadow=mesh.receiveShadow=true;fern.add(mesh);
        }
        counts.ferns++;
      }
    }
  }

  function onLight(n) {
    night=n;
    const L=api.lights;
    // pg() restores the astronomical light values before this adjustment.
    L.sun.intensity*=.68; L.hemisphere.intensity*=.9; L.ambient.intensity*=.55;
    L.sun.shadow.radius=3;L.sun.shadow.normalBias=.018;
    api.renderer.toneMappingExposure=T.MathUtils.lerp(.98,1.2,n);
    scene.environmentIntensity=T.MathUtils.lerp(.4,.12,n);
    for(const light of L.lamps) {light.intensity*=1.15;light.color.set('#ffd2a0');}
    api.ao.blendIntensity=.72;
    api.markShadows();
  }

  function glass() {
    for(const m of [M.glass,M.gableGlass]) {
      // Thin panes blend the sharp scene directly; screen-space transmission
      // resamples and visibly blurs the forest in this renderer.
      m.color.set('#ffffff');m.roughness=.025;m.metalness=0;
      m.transmission=0;m.thickness=0;m.ior=1.46;m.specularIntensity=1;
      m.opacity=.07;m.transparent=true;m.depthWrite=false;
      m.envMapIntensity=.55;m.needsUpdate=true;
    }
    M.reededGlass.roughness=.32;M.reededGlass.transmission=.24;
    M.reededGlass.thickness=.018;M.reededGlass.ior=1.46;M.reededGlass.needsUpdate=true;
  }

  const ready=Promise.all(Object.entries(manifest).map(([name,url])=>load(name,url))).then(()=>{
    for(const [material,family] of families) configureMaterial(material,family);
    glass();replaceFoliage();addWoodlandDetails();installed=true;refresh();api.relight();
    status=Object.values(assets).every(a=>a.state==='loaded')?'ready':'degraded';
    notice(status==='degraded'?'Some surface textures could not load. Reload the page to retry.':'');
    return snapshot();
  }).catch(error=>{
    status='failed';notice('Surface details could not load. Reload the page to retry.');
    return {...snapshot(),error:String(error?.message||error)};
  });
  window.__cabinRealism={ready,diagnostics:snapshot,getState:snapshot,refresh,onLight};
})();
