(function(root){
  'use strict';
  // @see https://github.com/whatgoodarewords/awf/issues/3
  const model=typeof module==='object'&&module.exports?require('./apple-model.js'):root.AppleModel;
  const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
  function pose(progress){const p=clamp(progress);return {angle:p===1?0:p*Math.PI*2,shape:smooth(p/.08),detail:smooth((p-.45)/.4),leafShedding:p,original:p===0};}
  function surfaceSize(viewport){const dpr=Math.min(2,viewport.dpr||1,Math.sqrt(4000000/(viewport.width*viewport.height)));return {width:Math.max(1,Math.floor(viewport.width*dpr)),height:Math.max(1,Math.floor(viewport.height*dpr)),dpr};}
  function flatTransform(part,rootZ=0){const m=part.matrix,o=part.offset;return [m[0],m[1],m[3],m[4],o[0]+m[6]*rootZ,o[1]+m[7]*rootZ];}
  // The browser and the Node reversal harness exercise this same controller.
  function createController({mesh,draw,visibility}){
    let last='';
    return {invalidate(){last='';},update(progress,fruitVisible,layout,state={}){
      const p=clamp(progress),active=!!layout&&state.ready!==false&&!state.hidden&&!state.reduced&&p>0&&p<1;
      if(!active){last='';visibility(false);return;}
      const size=surfaceSize(layout.viewport),spin=state.enabled!==false&&!state.fallback;
      const key=JSON.stringify([p,layout.layoutVersion,layout.trajectory,layout.viewport,size,spin,state.detail,state.fallback,state.materialVersion,layout.fruitAt(0),layout.fruitAt(1)]);
      if(key!==last){const stage=pose(p);if(!spin)stage.angle=0;if(!state.detail)stage.detail=0;
        draw({...stage,progress:p,flight:model.flightScene(mesh,layout,p,{spin}),size,layout,fallback:!!state.fallback});last=key;}
      // Airborne leaves can still be visible after the fruit leaves the view.
      visibility(true);
    }};
  }
  if(typeof module==='object'&&module.exports)module.exports={pose,surfaceSize,createController,flatTransform};
  if(!root?.document||!root.AppleArtwork||!model)return;
  const button=document.getElementById('fall-spin-toggle'),apple=document.querySelector('.scroll-apple'),scene=apple?.querySelector('svg');if(!button||!scene)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),handles=new Map();
  let enabled=true,renderer=null,variant=null,canvas=null,fallback=null,progress=0,visible=false,layout=null,controller=null,loading=false,failed=false;
  try{if(localStorage.getItem('awf-helicopter-default-18')!=='true'){localStorage.setItem('awf-helicopter','true');localStorage.setItem('awf-helicopter-default-18','true');}else enabled=localStorage.getItem('awf-helicopter')!=='false';}catch{}
  function surface(className){
    const c=document.createElement('canvas');c.className=className;c.hidden=true;c.setAttribute('aria-hidden','true');
    c.style.cssText='position:fixed;left:0;top:0;pointer-events:none;z-index:4';document.body.appendChild(c);return c;
  }
  function show(on){
    if(canvas)canvas.hidden=!on||!renderer;if(fallback)fallback.hidden=!on||!!renderer;
    scene.style.visibility=on?'hidden':'';
  }
  function paintHandles(){
    if(!variant)return;
    const source=variant.detailReady?model.endpoint(variant,'single'):variant.base;
    for(const [host,c] of handles){
      root.AppleArtwork.drawFrame(c.getContext('2d'),variant,variant.detailReady?1:0,source,'single');
      c.hidden=false;const svg=host.querySelector('svg');if(svg)svg.style.visibility='hidden';
    }
  }
  function drawFlat(frame,mesh){
    const ctx=fallback.getContext('2d'),v=frame.flight.viewport,sx=fallback.width/v.width,sy=fallback.height/v.height;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,fallback.width,fallback.height);
    const single=variant.detailReady?model.endpoint(variant,'single'):variant.base;
    const groups=mesh.groups.map((group,index)=>({group,index,depth:frame.flight.parts[index].root?.[2]||0})).sort((a,b)=>a.depth-b.depth);
    for(const {group,index} of groups){
      const part=frame.flight.parts[index],affine=flatTransform(part,group.root3?.[2]||0),extra=group.leaf!==undefined&&group.leaf!==null&&group.leaf!==1;
      // Airborne blades must never sample the deliberately bare single endpoint.
      const source=extra?variant.detail||variant.base:single;
      ctx.save();ctx.setTransform(affine[0]*sx,affine[1]*sy,affine[2]*sx,affine[3]*sy,affine[4]*sx,affine[5]*sy);
      ctx.save();ctx.scale(3,3);ctx.translate(-530,-312);const path=new Path2D(group.path);ctx.clip(path);
      if(group.kind==='petiole'){ctx.globalAlpha=1;ctx.fillStyle='#655726';ctx.fill(path);}
      ctx.scale(1/3,1/3);ctx.translate(1590,936);
      ctx.globalAlpha=1;ctx.drawImage(variant.base,0,0);if(frame.detail){ctx.globalAlpha=frame.detail;ctx.drawImage(source,0,0);}
      ctx.restore();ctx.restore();
    }
  }
  function sync(){
    button.checked=enabled;button.disabled=reduced.matches||failed;
    if(!controller){show(false);return;}
    controller.update(progress,visible,layout,{ready:!!variant,hidden:document.hidden,reduced:reduced.matches,enabled,detail:variant.detailReady,fallback:!renderer,materialVersion:variant.detailReady?1:0});
  }
  function setup(v){
    variant=v;fallback=surface('awf-fall-flat-viewport');canvas=surface('awf-fall-volume-viewport');
    const mesh=model.prepare(variant).geometry;
    try{renderer=model.renderer(canvas,{preserveDrawingBuffer:false,antialias:false});renderer.upload(variant);canvas.dataset.renderer='closed-green-volume';}
    catch(error){failed=true;canvas.dataset.rendererError=String(error?.message||error);}
    controller=createController({mesh,visibility:show,draw:frame=>{
      for(const c of [canvas,fallback]){
        if(c.width!==frame.size.width)c.width=frame.size.width;if(c.height!==frame.size.height)c.height=frame.size.height;
        c.style.width=frame.flight.viewport.width+'px';c.style.height=frame.flight.viewport.height+'px';
        c.style.zIndex=getComputedStyle(apple).zIndex;c.style.filter=apple.classList.contains('is-over-painting')?'drop-shadow(0 2px 2px #0003)':'none';
      }
      if(renderer)renderer.draw(variant,{...frame,leaves:'all'});else drawFlat(frame,mesh);
    }});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;renderer=null;controller.invalidate();sync();});
    paintHandles();button.removeAttribute('aria-busy');sync();
    root.AppleArtwork.loadDetail(variant).then(()=>{model.endpoint(variant,'single');if(renderer)renderer.upload(variant);paintHandles();controller.invalidate();sync();}).catch(()=>{});
  }
  function load(){
    if(loading)return;loading=true;button.setAttribute('aria-busy','true');
    root.AppleArtwork.loadBase('green').then(setup,error=>{failed=true;button.dataset.rendererError=String(error?.message||error);button.removeAttribute('aria-busy');show(false);sync();});
  }
  button.addEventListener('change',()=>{if(reduced.matches)return;enabled=button.checked;try{localStorage.setItem('awf-helicopter',String(enabled));}catch{}sync();});
  reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',()=>{controller?.invalidate();sync();});
  root.fallingAppleSpin={
    update(value,onScreen,nextLayout){progress=clamp(value);visible=onScreen;if(nextLayout)layout=nextLayout;sync();},
    attachHandle(host){
      if(handles.has(host))return;
      const c=document.createElement('canvas');c.className='fall-handle-canvas';c.width=594;c.height=654;c.hidden=true;c.style.cssText='position:absolute;left:0;top:50%;width:100%;height:auto;transform:translateY(-50%);pointer-events:none';c.setAttribute('aria-hidden','true');host.appendChild(c);handles.set(host,c);paintHandles();
    }
  };
  load();
})(typeof window==='object'?window:null);
