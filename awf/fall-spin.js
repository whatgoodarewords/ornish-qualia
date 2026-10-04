(function(root){
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
  function pose(progress){const p=clamp(progress);return {angle:p===1?0:p*Math.PI*2,shape:smooth(p/.08),detail:smooth((p-.45)/.4),leafShedding:p,original:p===0};}
  if(typeof module==='object'&&module.exports)module.exports={pose};
  if(!root?.document||!root.AppleArtwork||!root.AppleModel)return;
  const button=document.getElementById('fall-spin-toggle'),apple=document.querySelector('.scroll-apple'),scene=apple?.querySelector('svg');if(!button||!scene)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),handles=new Map();
  let enabled=true,renderer=null,variant=null,canvas=null,fallback=null,progress=0,visible=false,lastDraw='',loading=false,failed=false;
  try{if(localStorage.getItem('awf-helicopter-default-18')!=='true'){localStorage.setItem('awf-helicopter','true');localStorage.setItem('awf-helicopter-default-18','true');}else enabled=localStorage.getItem('awf-helicopter')!=='false';}catch{}
  function surface(className){
    const c=document.createElement('canvas');c.className=className;c.width=594;c.height=654;c.hidden=true;c.style.height='auto';c.style.top='50%';c.style.bottom='auto';c.style.transform='translateY(-50%)';c.setAttribute('aria-hidden','true');apple.appendChild(c);return c;
  }
  function restore(){if(canvas)canvas.hidden=true;if(fallback)fallback.hidden=true;scene.style.visibility='';}
  function paintHandles(){
    if(!variant)return;
    for(const [host,c] of handles){
      root.AppleArtwork.drawFrame(c.getContext('2d'),variant,variant.detailReady?1:0,variant.endpoint||variant.detail,1);
      c.hidden=false;const svg=host.querySelector('svg');if(svg)svg.style.visibility='hidden';
    }
  }
  function sync(){
    button.checked=enabled;button.disabled=reduced.matches||failed;
    if(!visible||document.hidden||!variant||progress===0){restore();return;}
    const p=pose(reduced.matches?1:progress);if(!enabled||reduced.matches)p.angle=0;
    if(!variant.detailReady)p.detail=0;
    const key=[progress,enabled,reduced.matches,variant.detailReady,failed].join(':');
    if(key!==lastDraw){
      if(renderer){renderer.draw(variant,{...p,padding:.5});canvas.hidden=false;fallback.hidden=true;}
      else{root.AppleArtwork.drawFrame(fallback.getContext('2d'),variant,p.detail,variant.endpoint||variant.detail,smooth(progress/.85));fallback.hidden=false;if(canvas)canvas.hidden=true;}
      lastDraw=key;
    }
    canvas.hidden=!renderer;fallback.hidden=!!renderer;scene.style.visibility='hidden';
  }
  function setup(v){
    variant=v;fallback=surface('fall-spin-canvas fall-flat-canvas');canvas=surface('fall-spin-canvas');
    // Extra viewport room lets detached blades leave without being sliced at
    // the original cutout's rectangular canvas edge. Fruit scale stays exact.
    canvas.width=792;canvas.height=872;canvas.style.width='200%';canvas.style.left='-50%';canvas.style.right='auto';
    try{renderer=root.AppleModel.renderer(canvas);renderer.upload(variant);canvas.dataset.renderer='closed-green-volume';}
    catch(error){failed=true;canvas.dataset.rendererError=String(error?.message||error);}
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;renderer=null;lastDraw='';sync();});
    paintHandles();button.removeAttribute('aria-busy');lastDraw='';sync();
    root.AppleArtwork.loadDetail(variant).then(()=>{
      root.AppleModel.endpoint(variant);if(renderer)renderer.upload(variant);paintHandles();lastDraw='';sync();
    }).catch(()=>{});
  }
  function load(){
    if(loading)return;loading=true;button.setAttribute('aria-busy','true');
    // The shared green source is independent of all main-stage colour state.
    root.AppleArtwork.loadBase('green').then(setup,error=>{failed=true;button.dataset.rendererError=String(error?.message||error);button.removeAttribute('aria-busy');restore();sync();});
  }
  button.addEventListener('change',()=>{if(reduced.matches)return;enabled=button.checked;try{localStorage.setItem('awf-helicopter',String(enabled));}catch{}sync();});
  reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',()=>{lastDraw='';sync();});
  root.fallingAppleSpin={
    update(value,onScreen){progress=clamp(value);visible=onScreen;sync();},
    attachHandle(host){
      if(handles.has(host))return;
      const c=document.createElement('canvas');c.className='fall-handle-canvas';c.width=594;c.height=654;c.hidden=true;c.style.cssText='position:absolute;left:0;top:50%;width:100%;height:auto;transform:translateY(-50%);pointer-events:none';c.setAttribute('aria-hidden','true');host.appendChild(c);handles.set(host,c);paintHandles();
    }
  };
  load();
})(typeof window==='object'?window:null);
