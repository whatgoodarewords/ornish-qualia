(function(root){
  'use strict';
  // These are the painting's original clip paths, in its unchanged image space.
  const paths=[
    'M613 415 C597 408 578 415 565 428 C553 439 554 459 557 478 C561 500 579 516 600 521 C620 526 644 517 658 501 C671 486 674 466 670 448 C667 429 655 418 641 413 C631 409 622 414 613 415 Z',
    'M539 320 C558 322 577 332 590 346 C601 357 607 361 616 356 C602 366 581 374 564 367 C550 358 548 338 539 320 Z',
    'M632 352 C647 331 662 320 680 323 C695 324 705 329 718 328 C714 341 699 350 682 354 C662 360 645 359 632 352 Z',
    'M607 369 C585 375 567 384 556 400 C550 411 549 420 546 428 C565 425 588 414 599 398 C604 386 605 377 607 369 Z',
    'M632 363 C651 363 676 367 688 379 C696 388 698 395 701 399 C683 402 662 401 651 393 C643 385 639 372 632 363 Z',
    'M628 371 C635 384 640 399 631 413 L617 415 C615 401 621 382 628 371 Z',
    'M624 336 C620 356 622 383 617 416 L623 415 C627 393 625 364 627 337 Z M624 345 L627 347 L607 370 L604 371 Z M626 347 L629 347 L640 367 L637 367 Z'
  ];
  function samplePath(path,steps=16){
    const tokens=path.match(/[MCLZ]|-?\d+(?:\.\d+)?/g),points=[];let i=0,x=0,y=0,start;
    while(i<tokens.length){
      const op=tokens[i++];
      if(op==='M'||op==='L'){x=+tokens[i++];y=+tokens[i++];points.push([x,y]);if(!start)start=[x,y];}
      else if(op==='C'){
        const ax=+tokens[i++],ay=+tokens[i++],bx=+tokens[i++],by=+tokens[i++],cx=+tokens[i++],cy=+tokens[i++],sx=x,sy=y;
        for(let j=1;j<=steps;j++){const t=j/steps,u=1-t;points.push([u*u*u*sx+3*u*u*t*ax+3*u*t*t*bx+t*t*t*cx,u*u*u*sy+3*u*u*t*ay+3*u*t*t*by+t*t*t*cy]);}x=cx;y=cy;
      }else if(op==='Z'&&start){x=start[0];y=start[1];}
    }
    if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.001)points.pop();
    return points;
  }
  const greenParts=paths.slice(0,6).map(path=>samplePath(path).map(([x,y])=>[x-530,y-312]));
  const greenStems=paths[6].match(/M[^M]+/g).map(path=>samplePath(path).map(([x,y])=>[x-530,y-312]));
  function createChoice({load,save=()=>{},preferred='green',changed=()=>{},failed=()=>{}}){
    const items={green:{status:'loading'},red:{status:'loading'}};let wanted=preferred==='red'?'red':'green',active=null;
    function reconcile(){
      const other=wanted==='green'?'red':'green';
      const next=items[wanted].status==='ready'?wanted:items[wanted].status==='failed'&&items[other].status==='ready'?other:null;
      if(next){active=next;changed(items[next].value,next,items);}
      else if(Object.values(items).every(item=>item.status==='failed'))failed();
    }
    const request=colour=>{if(!items[colour])return;wanted=colour;try{save(colour);}catch{}reconcile();};
    for(const colour of ['green','red'])Promise.resolve().then(()=>load(colour)).then(value=>{items[colour]={status:'ready',value};reconcile();},()=>{items[colour]={status:'failed'};reconcile();});
    return {request,get active(){return active;},get wanted(){return wanted;},items};
  }
  const petiolePath='M624 348 C627 349 631 350 634 351 L633 354 C629 353 626 352 624 351 Z';
  // Register material, never generated geometry. Rays map the source's actual
  // alpha contour into each original mask, so no guessed crop can expose gaps.
  function registeredPixels(source,width,height,polygon){
    const {data, width:sw,height:sh}=source;let l=sw,r=0,t=sh,b=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(data[(y*sw+x)*4+3]>127){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
    if(r<=l||b<=t)throw Error('Empty apple material');
    const box={l:Math.min(...polygon.map(p=>p[0])),r:Math.max(...polygon.map(p=>p[0])),t:Math.min(...polygon.map(p=>p[1])),b:Math.max(...polygon.map(p=>p[1]))};
    const cx=(box.l+box.r)/2,cy=(box.t+box.b)/2,rx=(box.r-box.l)/2,ry=(box.b-box.t)/2,sx=(l+r)/2,sy=(t+b)/2,srx=(r-l)/2,sry=(b-t)/2;
    const poly=polygon.map(([x,y])=>[(x-cx)/rx,(y-cy)/ry]),rays=2048,src=new Float32Array(rays),dst=new Float32Array(rays);
    for(let i=0;i<rays;i++){
      const a=i/rays*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);let edge=Infinity;
      for(let j=0;j<poly.length;j++){const p=poly[j],q=poly[(j+1)%poly.length],ex=q[0]-p[0],ey=q[1]-p[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-9)continue;const distance=(p[0]*ey-p[1]*ex)/det,u=(p[0]*dy-p[1]*dx)/det;if(distance>0&&u>=0&&u<=1)edge=Math.min(edge,distance);}
      dst[i]=Number.isFinite(edge)?edge:1;
      let distance=0;for(let step=1;step<=Math.max(sw,sh)*2;step++){const d=step/Math.max(sw,sh),x=Math.round(sx+dx*d*srx),y=Math.round(sy+dy*d*sry);if(x<0||y<0||x>=sw||y>=sh||data[(y*sw+x)*4+3]<128)break;distance=d;}
      src[i]=Math.max(.01,distance-.006);
    }
    const out=new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const nx=(x+.5-cx)/rx,ny=(y+.5-cy)/ry,a=(Math.atan2(ny,nx)+Math.PI*2)%(Math.PI*2),i=Math.floor(a/Math.PI/2*rays)%rays,d=Math.min(.995,Math.hypot(nx,ny)/dst[i])*src[i];
      const px=Math.max(0,Math.min(sw-1.001,sx+Math.cos(a)*d*srx)),py=Math.max(0,Math.min(sh-1.001,sy+Math.sin(a)*d*sry)),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,k=(y*width+x)*4;
      for(let c=0;c<3;c++)out[k+c]=data[(iy*sw+ix)*4+c]*(1-fx)*(1-fy)+data[(iy*sw+ix+1)*4+c]*fx*(1-fy)+data[((iy+1)*sw+ix)*4+c]*(1-fx)*fy+data[((iy+1)*sw+ix+1)*4+c]*fx*fy;
      out[k+3]=255;
    }
    return out;
  }
  const api={paths,greenParts,greenStems,petiolePath,samplePath,createChoice,registeredPixels};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root?.document)return;
  const cache=new Map();
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const image=url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Unable to load '+url));img.src=url;});
  function painted(source){
    const c=canvas(594,654),ctx=c.getContext('2d');ctx.scale(3,3);ctx.translate(-530,-312);
    const clip=new Path2D();for(const path of paths)clip.addPath(new Path2D(path));ctx.clip(clip);ctx.drawImage(source,0,0);return c;
  }
  function register(front,base,leaf){
    const c=canvas(base.width,base.height),ctx=c.getContext('2d');
    function part(source,index){
      const input=canvas(source.naturalWidth,source.naturalHeight),g=input.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0);
      const data=g.getImageData(0,0,input.width,input.height),warped=canvas(c.width,c.height),w=warped.getContext('2d'),pixels=w.createImageData(c.width,c.height);
      pixels.data.set(registeredPixels({data:data.data,width:input.width,height:input.height},c.width,c.height,greenParts[index].map(([x,y])=>[x*3,y*3])));w.putImageData(pixels,0,0);
      ctx.save();ctx.scale(3,3);ctx.translate(-530,-312);ctx.clip(new Path2D(paths[index]));ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(warped,0,0);ctx.restore();
    }
    part(front,0);part(leaf,2);
    ctx.save();ctx.scale(3,3);ctx.translate(-530,-312);
    const stalk=new Path2D(paths[6].match(/M[^M]+/g)[0]);stalk.addPath(new Path2D(petiolePath));ctx.clip(stalk);
    const bark=ctx.createLinearGradient(617,0,629,0);bark.addColorStop(0,'#493b1a');bark.addColorStop(.45,'#9a8548');bark.addColorStop(1,'#50471d');ctx.fillStyle=bark;ctx.fillRect(610,330,30,95);ctx.restore();return c;
  }
  // Composite each material inside the same body mask: the body stays opaque
  // while the four extra leaves disappear. Also serves the no-WebGL fallback.
  function drawFrame(ctx,variant,detail=1,source=variant.endpoint||variant.detail,foliage=detail){
    const t=Math.max(0,Math.min(1,detail)),base=variant.base;
    ctx.clearRect(0,0,base.width,base.height);
    if(t===0&&foliage===0){ctx.drawImage(base,0,0);return;}
    source=source||base;
    function part(path,amount,photo){ctx.save();ctx.scale(3,3);ctx.translate(-530,-312);ctx.clip(new Path2D(path));ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=amount;ctx.drawImage(photo,0,0);ctx.restore();}
    for(const index of [0,2]){part(paths[index],1,base);part(paths[index],t,source);}
    part(paths[6].match(/M[^M]+/g)[0],1,base);part(paths[6].match(/M[^M]+/g)[0],t,source);
    for(const index of [1,3,4,5])part(paths[index],1-foliage,base);
    for(const path of paths[6].match(/M[^M]+/g).slice(1))part(path,1-foliage,base);
    ctx.save();ctx.scale(3,3);ctx.translate(-530,-312);ctx.globalAlpha=foliage;ctx.fillStyle='#655726';ctx.fill(new Path2D(petiolePath));ctx.restore();
    part(petiolePath,t,source);
  }
  function loadBase(colour){
    if(!cache.has(colour))cache.set(colour,image(colour==='green'?'assets/magritte-full-resolution.jpg':'assets/apple.png').then(source=>({colour,source,base:colour==='green'?painted(source):source,baseId:colour==='green'?'painting-cutout':'apple.png',detailReady:colour==='red',detailActive:colour==='red',detail:null,skin:null})));
    return cache.get(colour);
  }
  function loadDetail(variant){
    if(variant.colour!=='green')return Promise.resolve(variant);
    if(!variant.detailPromise)variant.detailPromise=Promise.all([image('assets/apple-green-body-v3.png'),image('assets/apple-green-leaf-v2.png'),image('assets/apple-green-skin-v3.png')]).then(([front,leaf,skin])=>{
      variant.detail=register(front,variant.base,leaf);variant.skin=skin;variant.detailReady=true;return variant;
    });
    return variant.detailPromise;
  }
  root.AppleArtwork={...api,loadBase,loadDetail,painted,register,drawFrame};
})(typeof window==='object'?window:null);
