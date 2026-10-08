(function(root){
  'use strict';
  const shouldAnimate=s=>s.ready&&s.value>=940&&s.visible&&!s.hidden&&!s.results&&!s.reduced;
  if(typeof module==='object'&&module.exports)module.exports={shouldAnimate};
  if(!root?.document||!root.AppleModel)return;
  const canvas=document.getElementById('apple-spin'),photo=document.getElementById('apple'),api=root.appleExperience,reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let renderer=null,failed=false,visible=false,frame=0,last=null,elapsed=0,lastDraw=-Infinity,dirty=true,lastVariant=null;
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=null;}
  function restore(){canvas.hidden=true;photo.style.opacity='1';}
  function usable(){const v=api.artwork;return !failed&&!!renderer&&!!v&&(v.colour==='red'||v.detailReady&&v.detailActive);}
  function animated(){return shouldAnimate({ready:usable(),value:api.value,visible,hidden:document.hidden,results:api.resultsVisible,reduced:reduced.matches});}
  function schedule(){if(!frame&&visible&&!document.hidden&&!api.resultsVisible){last=last===null?performance.now():last;frame=requestAnimationFrame(tick);}}
  function invalidate(){
    dirty=true;if(api.value<940){elapsed=0;lastDraw=-Infinity;}
    if(!usable()||api.value<=900||reduced.matches||api.resultsVisible){stop();restore();return;}
    schedule();
  }
  function tick(now){
    frame=0;
    if(!visible||document.hidden||api.resultsVisible){last=null;return;}
    const v=api.artwork;
    if(!usable()||api.value<=900||reduced.matches){restore();last=null;return;}
    if(animated()&&last!==null)elapsed+=Math.max(0,Math.min(100,now-last));last=now;
    if(api.value<940)elapsed=0;
    if(dirty||now-lastDraw>=1000/30){
      const pose=root.AppleModel.stage(v.colour,api.value,v.detailActive),q=Math.max(0,Math.min(1,(api.value-900)/20)),foliage=q*q*(3-2*q);
      if(renderer.draw(v,{...pose,angle:elapsed*Math.PI*2/24000,geometry:v.artwork.geometry,leaves:'single',foliage})){
        // One fully painted replacement is exposed atomically. Input never hides
        // the previous complete image while it is waiting for the next frame.
        canvas.hidden=false;canvas.style.opacity='1';photo.style.opacity='0';canvas.dataset.colour=v.colour;canvas.dataset.source=v.baseId;
      }
      dirty=false;lastDraw=now;
    }
    if(animated())frame=requestAnimationFrame(tick);else last=null;
  }
  function prepare(){
    if(failed)return;
    try{
      if(!renderer)renderer=root.AppleModel.renderer(canvas);
      for(const variant of api.artworks)renderer.upload(variant);
      if(lastVariant!==api.artwork){lastVariant=api.artwork;elapsed=0;restore();}
      invalidate();
    }catch(error){failed=true;stop();restore();canvas.dataset.rendererError=String(error?.message||error);}
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;stop();restore();});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)stop();else invalidate();},{threshold:0}).observe(document.querySelector('.apple-stage'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else invalidate();});reduced.addEventListener('change',invalidate);
  api.onSelection(invalidate);api.subscribe(invalidate);api.onArtwork(prepare);
})(typeof window==='object'?window:null);
