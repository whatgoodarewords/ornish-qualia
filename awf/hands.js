(function(root){
  'use strict';
  const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
  // Finish while the wrists are still in view; there is no clock or idle loop.
  function handPhase(progress){const p=clamp(progress);return p*p*p*(p*(p*6-15)+10);}
  function frameAt(progress,count){return Math.round(handPhase(progress)*(count-1));}
  function patchPosition(patch,layout){return {left:layout.offsetX+patch.x*layout.scale,top:layout.offsetY+patch.y*layout.scale,width:patch.width*layout.scale,height:patch.height*layout.scale};}
  // The painting already rests three-quarter-on. Earlier atlas cells turn back
  // toward the knuckles before opening; these selected cells only turn outward.
  const assets={original:'assets/hero.png',cleanplate:'assets/hands-v1/cleanplate.png',atlas:'assets/hands-v1/hand-atlas.png',columns:5,frames:25,poses:[12,13,14,16,18,19,20,21,22,24],subdivisions:10,patches:[
    {name:'left',x:575,y:838,width:120,height:126,pivotX:61,pivotY:12,handLength:86},
    {name:'right',x:863,y:838,width:120,height:126,pivotX:59,pivotY:12,handLength:85,mirror:true}
  ]};
  function spritePlacement(cell,spec){return {scale:spec.handLength/(cell.bottom-cell.top),x:spec.pivotX,y:spec.pivotY,horizontal:spec.mirror?-1:1};}
  const skin=(r,g,b)=>r>g*1.1&&g>b*1.08&&r-g>15&&g>35&&b>20&&r-g<125;
  function cleanCell(data,width,height){
    const mask=new Uint8Array(width*height),seen=new Uint8Array(mask.length);let largest=[];
    for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>100&&skin(data[i*4],data[i*4+1],data[i*4+2])?1:0;
    // Keep one connected hand. Detached red/yellow extraction debris never
    // becomes a sprite, and all pixel analysis is confined to initial loading.
    for(let i=0;i<mask.length;i++)if(mask[i]&&!seen[i]){
      const component=[i];seen[i]=1;
      for(let k=0;k<component.length;k++){
        const at=component[k],x=at%width,y=Math.floor(at/width);
        for(const next of [x?at-1:-1,x<width-1?at+1:-1,y?at-width:-1,y<height-1?at+width:-1])if(next>=0&&mask[next]&&!seen[next]){seen[next]=1;component.push(next);}
      }
      if(component.length>largest.length)largest=component;
    }
    mask.fill(0);for(const i of largest)mask[i]=1;
    let left=width,right=0,top=height,bottom=0;
    for(let i=0;i<mask.length;i++){
      if(!mask[i]){data[i*4+3]=0;continue;}
      const x=i%width,y=Math.floor(i/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      if(!mask[i-1]||!mask[i+1]||!mask[i-width]||!mask[i+width])data[i*4+3]=Math.min(data[i*4+3],170);
    }
    if(largest.length<100)throw Error('Hand silhouette unavailable');
    let sum=0,count=0;for(let y=top;y<=top+3;y++)for(let x=left;x<=right;x++)if(mask[y*width+x]){sum+=x;count++;}
    return {data,width,height,left,right,top,bottom,pivotX:sum/count};
  }
  function rowBounds(data,width,height){
    return Array.from({length:height},(_,y)=>{
      let left=width,right=-1;
      for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=80){left=Math.min(left,x);right=x;}
      return right<0?null:{left,right};
    });
  }
  function tweenSilhouette(a,b,width,height,amount,boundsA=rowBounds(a,width,height),boundsB=rowBounds(b,width,height)){
    const t=clamp(amount);if(t===0)return new Uint8ClampedArray(a);if(t===1)return new Uint8ClampedArray(b);
    const output=new Uint8ClampedArray(a.length);
    for(let y=0;y<height;y++){
      const aa=boundsA[y],bb=boundsB[y];if(!aa&&!bb)continue;
      const first=aa||bb,last=bb||aa,left=first.left*(1-t)+last.left*t,right=first.right*(1-t)+last.right*t;
      for(let x=Math.max(0,Math.floor(left));x<=Math.min(width-1,Math.ceil(right));x++){
        // Both textures first meet at ONE moving silhouette. Their old edges
        // can never appear as two translucent hands during texture blending.
        const u=clamp((x-left)/Math.max(1,right-left));
        const ai=(y*width+Math.round(first.left+u*(first.right-first.left)))*4,bi=(y*width+Math.round(last.left+u*(last.right-last.left)))*4;
        const weightA=aa?(1-t)*a[ai+3]/255:0,weightB=bb?t*b[bi+3]/255:0,total=weightA+weightB;
        if(total<.5)continue; // Finger gaps change coverage, never become ghosts.
        const at=(y*width+x)*4,coverage=Math.max(0,Math.min(x+.5,right+.5)-Math.max(x-.5,left-.5));
        for(let k=0;k<3;k++)output[at+k]=(a[ai+k]*weightA+b[bi+k]*weightB)/total;
        output[at+3]=coverage*255;
      }
    }
    return output;
  }
  function prepareArtwork(document,original,plate,atlas,manifest){
    const make=(width,height,readback=false)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:readback});if(!context)throw Error('Hand canvas unavailable');return {canvas,context};};
    const cells=[];
    for(const index of manifest.poses){
      const column=index%manifest.columns,row=Math.floor(index/manifest.columns),rows=Math.ceil(manifest.frames/manifest.columns);
      const x=Math.round(column*atlas.naturalWidth/manifest.columns),y=Math.round(row*atlas.naturalHeight/rows),width=Math.round((column+1)*atlas.naturalWidth/manifest.columns)-x,height=Math.round((row+1)*atlas.naturalHeight/rows)-y;
      const part=make(width,height,true);part.context.drawImage(atlas,x,y,width,height,0,0,width,height);const pixels=part.context.getImageData(0,0,width,height),cell=cleanCell(pixels.data,width,height);part.context.putImageData(pixels,0,0);cells.push({...cell,canvas:part.canvas});
    }
    return manifest.patches.map(spec=>{
      const source=make(spec.width,spec.height,true),clean=make(spec.width,spec.height,true);
      source.context.drawImage(original,spec.x,spec.y,spec.width,spec.height,0,0,spec.width,spec.height);
      clean.context.drawImage(plate,spec.x*plate.naturalWidth/1561,spec.y*plate.naturalHeight/1008,spec.width*plate.naturalWidth/1561,spec.height*plate.naturalHeight/1008,0,0,spec.width,spec.height);
      const a=source.context.getImageData(0,0,spec.width,spec.height).data,b=clean.context.getImageData(0,0,spec.width,spec.height),mask=new Uint8Array(spec.width*spec.height),tone=[0,0,0];let count=0;
      // The connected source hand excludes similarly warm isolated wall flecks.
      cleanCell(a,spec.width,spec.height);
      for(let y=spec.pivotY;y<spec.height;y++)for(let x=0;x<spec.width;x++){
        const i=y*spec.width+x;if(a[i*4+3]){mask[i]=1;count++;for(let k=0;k<3;k++)tone[k]+=a[i*4+k];}
      }
      for(let i=0;i<mask.length;i++){
        const x=i%spec.width,y=Math.floor(i/spec.width);let near=mask[i];
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const px=x+dx,py=y+dy;if(px>=0&&px<spec.width&&py>=spec.pivotY&&py<spec.height&&mask[py*spec.width+px])near=1;}
        b.data[i*4+3]=near?255:0;
      }
      clean.context.putImageData(b,0,0);
      // Pose zero copies every original covered pixel, including its boundary.
      // It introduces the atlas through a registered geometric transition.
      const originalPose=source.context.getImageData(0,0,spec.width,spec.height);
      for(let i=0;i<mask.length;i++)originalPose.data[i*4+3]=b.data[i*4+3];
      const poses=[originalPose.data,...cells.map(cell=>{
        const frame=make(spec.width,spec.height,true),sprite=make(cell.width,cell.height,true);sprite.context.drawImage(cell.canvas,0,0);
        const pixels=sprite.context.getImageData(0,0,cell.width,cell.height),sum=[0,0,0];let samples=0;
        for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+3]>200){samples++;for(let k=0;k<3;k++)sum[k]+=pixels.data[i+k];}
        for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i+3])for(let k=0;k<3;k++)pixels.data[i+k]=Math.max(0,Math.min(255,pixels.data[i+k]+tone[k]/Math.max(1,count)-sum[k]/Math.max(1,samples)));
        sprite.context.putImageData(pixels,0,0);
        const {scale,horizontal,x,y}=spritePlacement(cell,spec);
        frame.context.save();frame.context.translate(x,y);frame.context.scale(horizontal*scale,scale);frame.context.drawImage(sprite.canvas,-cell.pivotX,-cell.top);frame.context.restore();
        return frame.context.getImageData(0,0,spec.width,spec.height).data;
      })],bounds=poses.map(pose=>rowBounds(pose,spec.width,spec.height)),frames=[];
      function cache(data){
        const hand=make(spec.width,spec.height),frame=make(spec.width,spec.height),pixels=hand.context.createImageData(spec.width,spec.height);pixels.data.set(data);hand.context.putImageData(pixels,0,0);
        frame.context.drawImage(clean.canvas,0,0);frame.context.drawImage(hand.canvas,0,0);frames.push(frame.canvas);
      }
      cache(poses[0]);
      for(let i=0;i<poses.length-1;i++)for(let step=1;step<=manifest.subdivisions;step++)cache(tweenSilhouette(poses[i],poses[i+1],spec.width,spec.height,step/manifest.subdivisions,bounds[i],bounds[i+1]));
      return {spec,frames};
    });
  }
  function createController({document,button,status,hero,roadPainting,reduced,makeImage,read,save,manifest=assets,prepare=prepareArtwork}){
    let enabled=false,loading=false,ready=false,failed=false,progress=0,visible=true,layout=null,lastFrame=-1;
    let patches=[];
    try{enabled=read()==='true';}catch{}
    const set=(target,key,value)=>{if(target[key]!==value)target[key]=value;};
    function hide(){for(const patch of patches){set(patch.canvas,'hidden',true);set(patch.canvas.style,'display','none');}}
    function label(){
      set(button,'checked',enabled);set(button,'disabled',reduced.matches);
      if(status){const text=reduced.matches?'Paused for reduced motion.':failed?'Hand artwork unavailable. Toggle off and on to retry.':loading?'Loading hand artwork…':'';set(status,'textContent',text);set(status,'hidden',!text);}
    }
    function position(){
      if(!layout)return;
      const host=layout.road?roadPainting:hero;
      for(const patch of patches){
        if(patch.canvas.parentNode!==host)host.appendChild(patch.canvas);
        const box=patchPosition(patch.spec,layout);
        Object.assign(patch.canvas.style,{left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,height:`${box.height}px`,zIndex:layout.road?'0':'-1'});
      }
    }
    function draw(index){
      for(let i=0;i<patches.length;i++){
        const {canvas,context,frames}=patches[i];
        context.clearRect(0,0,canvas.width,canvas.height);
        context.drawImage(frames[index],0,0);
      }
      lastFrame=index;
    }
    function sync(){
      label();
      const index=frameAt(progress,patches[0]?.frames.length||manifest.frames);
      // The untouched photograph is the exact rest pose, including failure paths.
      if(!enabled||reduced.matches||document.hidden||!visible||!ready||!layout||index===0){hide();return;}
      if(index!==lastFrame)draw(index);
      for(const patch of patches){set(patch.canvas,'hidden',false);set(patch.canvas.style,'display','block');}
    }
    function imageAt(source){return new Promise((resolve,reject)=>{
      const image=makeImage();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Hand artwork unavailable'));image.src=source;
    });}
    function load(){
      if(loading||ready)return;loading=true;failed=false;button.setAttribute('aria-busy','true');label();
      Promise.all([imageAt(manifest.original),imageAt(manifest.cleanplate),imageAt(manifest.atlas)]).then(images=>{
        const [original,plate,atlas]=images;
        if(original.naturalWidth!==1561||original.naturalHeight!==1008||plate.naturalWidth!==1561||Math.abs(plate.naturalHeight-1008)>1||!atlas.naturalWidth||!atlas.naturalHeight)throw Error('Hand artwork dimensions do not match the painting');
        const prepared=prepare(document,original,plate,atlas,manifest);
        const next=[];
        for(const {spec,frames} of prepared){
          const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
          if(!context)throw Error('Hand canvas unavailable');
          canvas.className='painted-hand';canvas.dataset.hand=spec.name;canvas.width=spec.width;canvas.height=spec.height;canvas.hidden=true;
          canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',pointerEvents:'none'});
          next.push({canvas,context,spec,frames});
        }
        patches=next;ready=true;position();
      }).catch(error=>{failed=true;button.dataset.artworkError=String(error.message||error);hide();}).finally(()=>{
        loading=false;button.removeAttribute('aria-busy');sync();
      });
    }
    function preference(){if(enabled&&!reduced.matches)load();sync();}
    button.addEventListener('change',()=>{
      if(reduced.matches){label();return;}
      enabled=button.checked;try{save(String(enabled));}catch{}preference();
    });
    reduced.addEventListener('change',preference);document.addEventListener('visibilitychange',sync);
    preference();
    return {setLayout(value){layout=value;position();sync();},update(value,onScreen=true){progress=clamp(value);visible=onScreen;sync();},get enabled(){return enabled;},get ready(){return ready;}};
  }
  if(typeof module==='object'&&module.exports)module.exports={handPhase,frameAt,patchPosition,createController,assets,cleanCell,prepareArtwork,rowBounds,tweenSilhouette,spritePlacement};
  if(!root?.document)return;
  const document=root.document,button=document.getElementById('hands-turn-toggle'),hero=document.querySelector('.hero'),roadPainting=document.querySelector('.road-painting');
  if(!button||!hero||!roadPainting)return;
  root.paintedHands=createController({document,button,status:document.getElementById('hands-turn-status'),hero,roadPainting,reduced:root.matchMedia('(prefers-reduced-motion: reduce)'),makeImage:()=>new root.Image(),read:()=>root.localStorage.getItem('awf-hands-turn'),save:value=>root.localStorage.setItem('awf-hands-turn',value),manifest:root.PaintedHandsAssets||assets});
})(typeof window==='object'?window:null);
