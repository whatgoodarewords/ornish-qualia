(function(root){
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
  function pose(progress){const p=clamp(progress);return {angle:p*Math.PI*2,shape:smooth(p/.08)*smooth((1-p)/.08),detail:0,original:p===0||p===1};}
  if(typeof module==='object'&&module.exports)module.exports={pose};
  if(!root?.document||!root.AppleArtwork||!root.AppleModel)return;
  const button=document.getElementById('fall-spin-toggle'),apple=document.querySelector('.scroll-apple'),scene=apple?.querySelector('svg');if(!button||!scene)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let enabled=true,renderer=null,variant=null,canvas=null,progress=0,visible=false,lastDraw=-1,loading=false,failed=false;
  try{if(localStorage.getItem('awf-helicopter-default-18')!=='true'){localStorage.setItem('awf-helicopter','true');localStorage.setItem('awf-helicopter-default-18','true');}else enabled=localStorage.getItem('awf-helicopter')!=='false';}catch{}
  function restore(){if(canvas)canvas.hidden=true;scene.style.visibility='';}
  function sync(){
    button.checked=enabled;button.disabled=reduced.matches||failed;
    if(!enabled||reduced.matches||!visible||document.hidden||!renderer||pose(progress).original){restore();return;}
    if(lastDraw!==progress){renderer.draw(variant,pose(progress));lastDraw=progress;}
    canvas.hidden=false;scene.style.visibility='hidden';
  }
  function load(){
    if(loading||renderer||failed)return;loading=true;button.setAttribute('aria-busy','true');
    // This source is independent of main-colour selection and its fallback.
    const image=new Image();
    image.onload=()=>{try{
      variant={colour:'green',base:root.AppleArtwork.painted(image),baseId:'painting-cutout',detail:null,skin:null};
      canvas=document.createElement('canvas');canvas.className='fall-spin-canvas';canvas.width=396;canvas.height=436;canvas.hidden=true;canvas.style.height='auto';canvas.style.top='50%';canvas.style.bottom='auto';canvas.style.transform='translateY(-50%)';canvas.setAttribute('aria-hidden','true');apple.appendChild(canvas);
      renderer=root.AppleModel.renderer(canvas);renderer.upload(variant);canvas.dataset.renderer='closed-green-volume';
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;renderer=null;restore();sync();});
      button.removeAttribute('aria-busy');sync();
    }catch(error){fail(error);}};
    image.onerror=()=>fail(Error('Painting image unavailable'));image.src=scene.querySelector('image').getAttribute('href');
  }
  function fail(error){failed=true;renderer=null;button.dataset.rendererError=String(error?.message||error);button.removeAttribute('aria-busy');restore();sync();}
  function preference(){if(enabled&&!reduced.matches)load();sync();}
  button.addEventListener('change',()=>{if(reduced.matches)return;enabled=button.checked;try{localStorage.setItem('awf-helicopter',String(enabled));}catch{}if(enabled)load();sync();});
  reduced.addEventListener('change',preference);document.addEventListener('visibilitychange',sync);
  root.fallingAppleSpin={update(value,onScreen){progress=clamp(value);visible=onScreen;sync();}};preference();
})(typeof window==='object'?window:null);
