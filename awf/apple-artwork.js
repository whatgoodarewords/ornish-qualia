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
  const api={paths,greenParts,greenStems,samplePath,createChoice};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root?.document)return;
  const cache=new Map();
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const image=url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Unable to load '+url));img.src=url;});
  function painted(source){
    const c=canvas(594,654),ctx=c.getContext('2d');ctx.scale(3,3);ctx.translate(-530,-312);
    const clip=new Path2D();for(const path of paths)clip.addPath(new Path2D(path));ctx.clip(clip);ctx.drawImage(source,0,0);return c;
  }
  function register(front,base,skin){
    const c=canvas(base.width,base.height),ctx=c.getContext('2d');ctx.drawImage(base,0,0);ctx.scale(3,3);
    // Register each generated part independently; the original masks own the silhouette.
    const regions=[
      {src:[238,510,770,722],dst:[24,97,120,117]},
      {src:[67,55,469,338],dst:[9,8,77,49]},
      {src:[708,77,499,279],dst:[102,8,86,47]},
      {src:[95,354,458,401],dst:[16,57,61,59]},
      {src:[704,347,480,361],dst:[102,51,69,40]},
      {src:[556,366,114,252],dst:[85,59,25,44]}
    ];
    // The generated central leaf/stalk overlaps its fruit. Remove those pixels
    // from the fruit-only material before registration, using clean nearby skin.
    const body=canvas(front.naturalWidth,front.naturalHeight),b=body.getContext('2d');b.drawImage(front,0,0);
    for(const [x,y,rx,ry] of [[625,563,105,85],[350,586,160,145],[910,548,145,100]]){
      const patch=canvas(Math.ceil(rx*2),Math.ceil(ry*2)),p=patch.getContext('2d');
      p.drawImage(skin,0,0,skin.naturalWidth,skin.naturalHeight,0,0,patch.width,patch.height);
      p.globalCompositeOperation='destination-in';p.save();p.scale(rx,ry);
      const fade=p.createRadialGradient(1,1,.48,1,1,1);fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');p.fillStyle=fade;p.fillRect(0,0,2,2);p.restore();
      b.drawImage(patch,x-rx,y-ry);
    }
    for(let i=0;i<regions.length;i++){
      ctx.save();ctx.translate(-530,-312);ctx.clip(new Path2D(paths[i]));ctx.translate(530,312);
      ctx.drawImage(i===0?body:front,...regions[i].src,...regions[i].dst);ctx.restore();
    }
    ctx.save();ctx.translate(-530,-312);ctx.clip(new Path2D(paths[6]));ctx.translate(530,312);
    ctx.drawImage(front,590,192,94,390,86,24,13,81);ctx.restore();return c;
  }
  function loadBase(colour){
    if(!cache.has(colour))cache.set(colour,image(colour==='green'?'assets/magritte-full-resolution.jpg':'assets/apple.png').then(source=>({colour,source,base:colour==='green'?painted(source):source,baseId:colour==='green'?'painting-cutout':'apple.png',detailReady:colour==='red',detailActive:colour==='red',detail:null,skin:null})));
    return cache.get(colour);
  }
  function loadDetail(variant){
    if(variant.colour!=='green')return Promise.resolve(variant);
    if(!variant.detailPromise)variant.detailPromise=Promise.all([image('assets/apple-green-hyperreal-v1.png'),image('assets/apple-green-skin-v1.png')]).then(([front,skin])=>{
      variant.detail=register(front,variant.base,skin);variant.skin=skin;variant.detailReady=true;return variant;
    });
    return variant.detailPromise;
  }
  root.AppleArtwork={...api,loadBase,loadDetail,painted,register};
})(typeof window==='object'?window:null);
