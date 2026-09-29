/* Progressive enhancement: the same DOM, artwork and lighting clock, rendered
   with Canvas 2D when WebGL is unavailable. No duplicate content or screenshots. */
function startCanvasLake(original) {
  if(document.documentElement.classList.contains('nogl')) return;
  document.documentElement.classList.add('nogl');
  let canvas=original,ctx=canvas.getContext('2d');
  if(!ctx){canvas=original.cloneNode(false);original.replaceWith(canvas);ctx=canvas.getContext('2d');}
  if(!ctx){QUALIA_LOAD.done('graphics');return;}
  const mark=document.querySelector('.mark'),tagline=document.querySelector('.sub'),footer=document.querySelector('.foot');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const layer=()=>{const c=document.createElement('canvas');return {c,x:c.getContext('2d')};};
  const sky=layer(),reflection=layer(),cloud=layer(),tintedCloud=layer(),moon=layer();
  const trees=new Image();trees.src=QUALIA_ART.woodland;
  // A small static grain tile; soft-light naturally concentrates it in midtones.
  const grain=layer();grain.c.width=256;grain.c.height=256;
  const grainPixels=grain.x.createImageData(256,256);let grainSeed=40139;
  for(let i=0;i<grainPixels.data.length;i+=4){
    grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0;
    const value=100+(grainSeed>>>24)*.22;
    grainPixels.data[i]=grainPixels.data[i+1]=grainPixels.data[i+2]=value;grainPixels.data[i+3]=255;
  }
  grain.x.putImageData(grainPixels,0,0);const grainPattern=ctx.createPattern(grain.c,'repeat');
  let distantRidge=new Path2D();
  const controlImage=new Image(),control=document.querySelector('#faq-open svg');let controlRect=null;
  if(control){const svg=control.cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','22');svg.setAttribute('height','26');svg.style.color='#fff';controlImage.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));}
  let W=1,H=1,shore=1,scale=1,anchor=[0,0,1],imageRect=null,markRect=null,words=[],last=0,elapsed=0,raf=0;
  let portrait=null,moonMinute=-1,painted=false;
  const cycle=createQualiaCycle(()=>({width:W,height:H,shore}));
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,v)=>{v=clamp((v-a)/(b-a));return v*v*(3-2*v);};
  let seed=91217;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const stars=Array.from({length:460},()=>[random(),random(),.25+random()*.6,random()]);
  // A cached, irregular density field, rather than circular cloud sprites.
  function noise(x,y){const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};const a=Math.floor(x),b=Math.floor(y);let u=x-a,v=y-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
  cloud.c.width=512;cloud.c.height=192;tintedCloud.c.width=512;tintedCloud.c.height=192;
  const pixels=cloud.x.createImageData(512,192);
  for(let y=0;y<192;y++)for(let x=0;x<512;x++){
    let density=0,weight=.55,frequency=1;
    for(let o=0;o<5;o++){density+=noise(x/88*frequency,y/46*frequency)*weight;weight*=.5;frequency*=2.03;}
    const i=(y*512+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;
    pixels.data[i+3]=Math.round(smooth(.50,.78,density)*150*(1-smooth(.7,1,y/192)));
  }
  cloud.x.putImageData(pixels,0,0);
  function rgb(night,day,warm,d,t){return 'rgb('+night.map((n,i)=>Math.round(n+(day[i]-n)*d+(warm[i]-(n+(day[i]-n)*d))*t*.62)).join(',')+')';}
  function layout(){
    W=innerWidth;H=innerHeight;shore=Math.round(H*QUALIA_SHORE);scale=Math.min(devicePixelRatio||1,1.5,1440/W);
    canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);
    for(const l of [sky,reflection]){l.c.width=Math.ceil(W*scale);l.c.height=Math.ceil(shore*scale);l.x.setTransform(scale,0,0,scale,0,0);}
    ctx.setTransform(scale,0,0,scale,0,0);
    distantRidge=new Path2D();distantRidge.moveTo(0,shore);
    for(let x=0;x<=W+8;x+=8)distantRidge.lineTo(x,shore-H*(.033+.020*noise(x/180,8)));
    distantRidge.lineTo(W,shore);distantRidge.closePath();
    controlRect=control?.getBoundingClientRect();
    const image=mark.querySelector('img');imageRect=image?.getBoundingClientRect();markRect=mark.getBoundingClientRect();
    if(imageRect){anchor=[imageRect.left+imageRect.width*.715,imageRect.top+imageRect.height*.315,imageRect.width*.0245];QUALIA_LOAD.setAnchor(anchor);}
    words=[...tagline.querySelectorAll('span')].map(e=>({text:e.textContent,box:e.getBoundingClientRect(),style:getComputedStyle(e.parentElement)}));
    layoutQualiaFooter(mark,footer,H,shore);
  }
  function phaseMoon(){
    const minute=Math.floor(Date.now()/60000),texture=QUALIA_LOAD.portrait;
    if(portrait===texture&&moonMinute===minute)return;
    portrait=texture;moonMinute=minute;moon.c.width=128;moon.c.height=128;
    let fraction=1,waxing=true;
    try{fraction=Astronomy.Illumination('Moon',new Date()).phase_fraction;waxing=Astronomy.MoonPhase(new Date())<180;}catch(_){}
    const m=moon.x;m.clearRect(0,0,128,128);
    if(texture)m.drawImage(texture,0,0,128,128);else{m.fillStyle='#dddcd6';m.beginPath();m.arc(64,64,64,0,Math.PI*2);m.fill();}
    m.globalCompositeOperation='destination-in';m.save();m.scale(4,4);m.translate(16,16);m.scale(16/14,16/14);m.translate(-16,-16);
    if(!waxing){m.translate(32,0);m.scale(-1,1);}
    const r=Math.max(.001,14*Math.abs(1-2*fraction));m.fill(new Path2D(`M16 2A14 14 0 0 1 16 30A${r} 14 0 0 ${fraction<.5?0:1} 16 2Z`));m.restore();m.globalCompositeOperation='source-over';
  }
  function drawMoon(x,y,r,alpha){
    if(alpha<.001)return;const s=sky.x;s.save();s.globalAlpha=alpha;
    if(portrait){s.globalAlpha=alpha*.065;s.drawImage(portrait,x-r,y-r,r*2,r*2);s.globalAlpha=alpha;}
    s.drawImage(moon.c,x-r,y-r,r*2,r*2);s.restore();
  }
  function drawSky(values,time){
    const [day,twilight,starlight,warmth,sunX,sunY]=values,s=sky.x;
    s.globalAlpha=1;const gradient=s.createLinearGradient(0,0,0,shore);
    gradient.addColorStop(0,rgb([2,6,14],[39,79,116],[52,57,86],day,twilight));
    gradient.addColorStop(.65,rgb([8,17,29],[93,140,169],[170,102,101],day,twilight));
    gradient.addColorStop(1,rgb([18,31,41],[172,187,180],[255,171,93],day,twilight));
    s.fillStyle=gradient;s.fillRect(0,0,W,shore);
    if(starlight>.001){s.fillStyle='#dbe6ef';for(const [x,y,r,a] of stars){s.globalAlpha=starlight*(.2+a*.65)*(1-y*.4);s.beginPath();s.arc(x*W,y*shore,r,0,Math.PI*2);s.fill();}s.globalAlpha=1;}
    const sx=sunX*W,sy=sunY*shore,r=cycle.sunRadius(values),solar=smooth(1.2,.94,sunY);
    if(solar>0){const glow=s.createRadialGradient(sx,sy,r*.3,sx,sy,r*8);glow.addColorStop(0,`rgba(255,222,145,${.48*solar})`);glow.addColorStop(.2,`rgba(255,197,100,${.15*solar})`);glow.addColorStop(1,'rgba(255,182,95,0)');s.fillStyle=glow;s.fillRect(sx-r*8,sy-r*8,r*16,r*16);s.fillStyle=twilight>.2?'#ffe0a0':'#fff2c0';s.globalAlpha=solar;s.beginPath();s.ellipse(sx,sy,r,r*(1-.1*twilight),0,0,Math.PI*2);s.fill();s.globalAlpha=1;}
    // Tight warm halation around a luminous disc; no full-screen glow filter.
    if(solar>0){
      const bleed=s.createRadialGradient(sx,sy,r*.92,sx,sy,r*1.65);
      bleed.addColorStop(0,'rgba(255,148,68,0)');bleed.addColorStop(.16,'rgba(255,159,82,.10)');bleed.addColorStop(1,'rgba(255,159,82,0)');
      s.save();s.globalAlpha=solar;s.fillStyle=bleed;s.fillRect(sx-r*1.7,sy-r*1.7,r*3.4,r*3.4);s.restore();
    }
    const tc=tintedCloud.x;tc.clearRect(0,0,512,192);tc.drawImage(cloud.c,0,0);tc.globalCompositeOperation='source-in';tc.fillStyle=rgb([31,42,57],[244,242,226],[235,153,117],day,twilight);tc.fillRect(0,0,512,192);tc.globalCompositeOperation='source-over';
    const drift=motion.matches?0:Math.sin(time*.004)*W*.06;
    s.drawImage(tintedCloud.c,-W*.12+drift,0,W*1.24,shore*.95);
    const travel=smooth(.3,1,PAQ.t),target=cycle.paqMoonAt(motion.matches?0:time);
    const mx=anchor[0]+(target[0]-anchor[0])*travel+Math.min(PAQ.scrollY*.14,42)*travel;
    const lift=motion.matches?0:H*.12*PAQ.progress;
    const arc=motion.matches?0:4*travel*(1-travel)*Math.min(H*.055,Math.abs(target[0]-anchor[0])*.28);
    const my=anchor[1]+(target[1]-anchor[1])*travel-arc-PAQ.scrollY*travel+lift;
    const mr=anchor[2]+(target[2]-anchor[2])*travel;
    const moonVisibility=(1-smooth(.08,.72,day))*(1-PAQ.progress)+PAQ.progress;
    drawMoon(mx,my,mr,moonVisibility*QUALIA_LOAD.moonReveal);
    mark.style.setProperty('--dot-alpha',smooth(.08,.72,day));
    // A subdued far ridge picks up sky colour; the real near foliage stays crisp.
    s.fillStyle=rgb([4,11,17],[58,82,83],[102,83,82],day,twilight);s.fill(distantRidge);
    // The real leaf alpha and source photograph are shared with the GPU renderer.
    if(trees.complete&&trees.naturalWidth){
      s.save();s.filter=`brightness(${.055+.59*day}) saturate(.72)`;
      const th=Math.max(95,H*.22),tw=th*trees.naturalWidth/trees.naturalHeight;
      for(let i=0,x=-tw*.13;x<W;i++,x+=tw){s.save();s.translate(x+(i%2?tw:0),shore-th*.64);s.scale(i%2?-1:1,1);s.drawImage(trees,0,0,tw,th);s.restore();}
      s.restore();
    } else {
      s.fillStyle=day>.3?'#29443b':'#02090d';s.beginPath();s.moveTo(0,shore);
      for(let x=0;x<=W;x+=6)s.lineTo(x,shore-H*(.018+.012*noise(x/100,4)));s.lineTo(W,shore);s.fill();
    }
  }
  function drawLetterReflection(day){
    const x=reflection.x,image=mark.querySelector('img'),hero=1-smooth(0,.5,PAQ.progress);
    x.clearRect(0,0,W,shore);if(hero<=0)return;
    const dark=document.body.classList.contains('ink-dark');
    if(image?.complete&&image.naturalWidth&&imageRect){x.save();x.beginPath();x.rect(markRect.left,markRect.top,markRect.width,markRect.height);x.clip();x.globalAlpha=QUALIA_LOAD.reflectionInk*hero;x.filter=dark?'brightness(0)':'none';x.drawImage(image,imageRect.left,imageRect.top,imageRect.width,imageRect.height);x.restore();}
    x.save();x.globalCompositeOperation='destination-out';x.globalAlpha=1-smooth(.08,.72,day);x.beginPath();x.ellipse(anchor[0],anchor[1],anchor[2]*1.25,anchor[2]*1.25,0,0,Math.PI*2);x.fill();x.restore();
    x.globalAlpha=QUALIA_LOAD.reflectionCaption*hero;x.fillStyle=dark?'#080b10':'#e4eaf1';x.textBaseline='alphabetic';
    for(const {text,box,style} of words){x.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const metrics=x.measureText('Ag'),asc=metrics.fontBoundingBoxAscent||parseFloat(style.fontSize)*.9,desc=metrics.fontBoundingBoxDescent||0;x.fillText(text,box.left,box.top+(box.height-asc-desc)/2+asc);}
    if(controlImage.complete&&controlImage.naturalWidth&&controlRect){x.globalAlpha=QUALIA_LOAD.controlsReveal*hero*.96;x.drawImage(controlImage,controlRect.left,controlRect.top,controlRect.width,controlRect.height);}
    x.globalAlpha=1;
  }
  function reflect(source,alpha,time){
    ctx.save();ctx.globalAlpha=alpha;
    const transform=ctx.getTransform();ctx.setTransform(1,0,0,-1,transform.e,transform.f+source.height*2);
    // Integer backing-pixel strips avoid seams or bright overlapping scanlines.
    for(let y=0;y<source.height;y+=2){const depth=1-y/source.height,cssY=y/scale,wave=motion.matches?0:Math.sin(cssY*.10+time*.65)*(.25+depth*1.1)+Math.sin(cssY*.037-time*.43)*depth;
      const wind=.5+.5*Math.sin(cssY*.023-time*.045);
      ctx.globalAlpha=alpha*(1-.055*wind*depth);
      const height=Math.min(2,source.height-y);
      ctx.drawImage(source,0,y,source.width,height,wave*scale,y,source.width,height);
      // Two low-opacity neighbouring footprints soften patches without strip seams.
      if(wind*depth>.32){ctx.globalAlpha=alpha*.018*wind*depth;ctx.drawImage(source,0,y,source.width,height,(wave+.65)*scale,y,source.width,height);}
    }
    ctx.restore();
  }
  function paint(now){
    raf=0;if(document.hidden)return;
    const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
    if(QUALIA_LOAD.active&&!motion.matches)elapsed+=dt;
    phaseMoon();const values=cycle.cycleAt(elapsed).values;
    ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle='#02090e';ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(0,motion.matches?0:-H*.12*PAQ.progress);
    drawSky(values,elapsed);ctx.drawImage(sky.c,0,0,W,shore);
    reflect(sky.c,.60,elapsed);drawLetterReflection(values[0]);reflect(reflection.c,.29,elapsed);
    const wash=ctx.createLinearGradient(0,shore,0,H);wash.addColorStop(0,'#06131b10');wash.addColorStop(.55,'#03111c4a');wash.addColorStop(1,'#01070de8');ctx.fillStyle=wash;ctx.fillRect(0,shore,W,H-shore+H*.12);
    ctx.restore();
    ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.045;ctx.fillStyle=grainPattern;ctx.fillRect(0,0,W,shore);
    ctx.globalAlpha=.024;ctx.fillRect(0,shore,W,H-shore);ctx.restore();
    if(!painted){painted=true;QUALIA_LOAD.done('graphics');}
    // At most 20 fps; pause entirely in background tabs. Reduced-motion stills
    // repaint at a low rate so UI fades, resizes and lunar updates remain correct.
    raf=setTimeout(()=>requestAnimationFrame(paint),motion.matches?100:50);
  }
  const observer=new ResizeObserver(layout);observer.observe(document.querySelector('.brand-lockup'));observer.observe(footer);
  addEventListener('resize',layout,{passive:true});mark.addEventListener('load',layout,true);document.fonts?.ready.then(layout);
  document.addEventListener('visibilitychange',()=>{clearTimeout(raf);if(!document.hidden){last=0;requestAnimationFrame(paint);}});
  layout();requestAnimationFrame(paint);
}
