(function (root) {
  'use strict';
  // Slider position is linear elapsed time. Artwork follows this same timing
  // map for both playback and scrubbing, retaining only brief visual holds.
  const PLAYBACK_KNOTS = Object.freeze([
    [0,0],[.10,900],[.225,1550],[.407,5750],[.49,6100],
    [.54,6700],[.57,7300],[.62,7480],[.67,8680],[.72,8860],
    [.815,10560],[.855,10740],[.995,12940],[1,13000]
  ].map(([progress,time])=>Object.freeze({progress,time})));
  const DURATION = PLAYBACK_KNOTS[PLAYBACK_KNOTS.length-1].time;
  const SIZE = 720;
  const WORD_INK = 'rgb(208,199,179)';
  const SEMANTIC_NODES = Object.freeze([
    {word:'apple',x:350,y:330,size:60,role:'center'},
    {word:'orchard',x:410,y:105,size:30,role:'edge'},
    {word:'crisp',x:150,y:145,size:30,role:'edge'},
    {word:'fresh',x:95,y:335,size:30,role:'edge'},
    {word:'sweet',x:145,y:515,size:30,role:'edge'},
    {word:'crunch',x:105,y:630,size:28,role:'edge'},
    {word:'fruit',x:500,y:535,size:30,role:'edge'},
    {word:'tart',x:600,y:285,size:30,role:'edge'},
    {word:'seed',x:625,y:480,size:30,role:'edge'}
  ].map(Object.freeze));
  const EDGE_WORDS = Object.freeze(SEMANTIC_NODES.map(node=>node.word));
  // Cubic web connections stop at the labels' margins. These same curves,
  // sampled once, supply every point that will gather into the traced outline.
  const SEMANTIC_LINKS = Object.freeze([
    ['apple','orchard',[350,285,355,225,315,155,352,122]],
    ['apple','crisp',[300,289,245,264,248,170,195,151]],
    ['apple','fresh',[270,332,218,375,178,354,143,338]],
    ['apple','sweet',[294,373,265,420,241,492,188,509]],
    ['sweet','crunch',[143,541,146,570,125,597,114,610]],
    ['apple','fruit',[395,370,412,422,432,504,457,523]],
    ['apple','tart',[438,326,488,348,505,281,563,286]],
    ['tart','seed',[619,310,586,348,642,413,625,454]],
    ['orchard','tart',[471,119,516,134,512,230,576,263]],
    ['fruit','seed',[543,536,576,563,576,494,588,489]]
  ].map(([from,to,curve])=>Object.freeze({from,to,curve:Object.freeze(curve)})));
  const FRUIT_TAIL=Object.freeze([515,558,546,592,540,628,577,644]);
  const TENDRIL_START=.30, TENDRIL_ARRIVAL=.475;
  const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
  const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
  const bell = (a, b, c, d, p) => smooth(a, b, p) * (1 - smooth(c, d, p));
  function timelineValue(value,input,output) {
    const first=PLAYBACK_KNOTS[0],last=PLAYBACK_KNOTS[PLAYBACK_KNOTS.length-1];
    const bounded=clamp(value,first[input],last[input]);
    for(let i=1;i<PLAYBACK_KNOTS.length;i++) {
      const end=PLAYBACK_KNOTS[i],start=PLAYBACK_KNOTS[i-1];
      if(bounded<=end[input]) {
        const fraction=(bounded-start[input])/(end[input]-start[input]);
        return start[output]+fraction*(end[output]-start[output]);
      }
    }
    return last[output];
  }
  const playbackProgress=time=>timelineValue(time,'time','progress');
  const playbackTime=progress=>timelineValue(progress,'progress','time');
  const advancePlayback=(progress,elapsed)=>clamp(clamp(progress)+Math.max(0,Number.isFinite(elapsed)?elapsed:0)/DURATION);
  function makeMotion(from,to,bend=0) {
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
    return {from:{...from},to:{...to},cx:(from.x+to.x)/2-dy/length*bend,cy:(from.y+to.y)/2+dx/length*bend};
  }
  function wordPose(motion,amount) {
    const t=smooth(0,1,amount),u=1-t;
    return {x:u*u*motion.from.x+2*u*t*motion.cx+t*t*motion.to.x,y:u*u*motion.from.y+2*u*t*motion.cy+t*t*motion.to.y,size:motion.from.size+(motion.to.size-motion.from.size)*t,angle:motion.from.angle+(motion.to.angle-motion.from.angle)*t};
  }
  function illustrationColor(r, g, b, x, y, colour='red') {
    const light=r*.55+g*.3+b*.15;
    const mix=(a,b,t)=>a.map((value,index)=>value+(b[index]-value)*t);
    let color=mix([82,24,28],[130,35,34],smooth(47,69,light));
    color=mix(color,[165,54,43],smooth(82,102,light));
    color=mix(color,[189,89,63],smooth(123,143,light));
    if(colour==='green')color=mix([49,65,29],[144,161,72],smooth(35,180,r*.25+g*.65+b*.1));
    // Hue and a narrow, sloping stem region distinguish plant parts. Height alone
    // must never recolour the fruit's shoulders as a horizontal brown band.
    const leaf=smooth(.73,.90,g/(r+1))*smooth(1.05,1.45,g/(b+1))*(1-smooth(.16,.26,y));
    const stem=(1-leaf)*smooth(.42,.62,g/(r+1))*(1-smooth(.23,.27,y))*(1-smooth(.035,.065,Math.abs(x-(.57-.18*y))));
    color=mix(color,mix([78,60,37],[129,95,53],smooth(55,130,r)),stem);
    return mix(color,mix([64,73,42],[105,113,61],smooth(45,105,g)),leaf).map(Math.round);
  }

  function smoothOutline(loop){
    return loop.map((_,i)=>{let x=0,y=0;for(let k=-2;k<=2;k++){const p=loop[(i+k+loop.length)%loop.length];x+=p[0];y+=p[1];}return [x/5,y/5];});
  }
  // The visual is a pure function of progress: scrubbing, playback and still QA frames agree.
  function sample(progress) {
    const p = clamp(progress);
    return {
      progress: p,
      semanticMap: bell(.012,.10,.225,.407,p),
      connections: bell(.035,.10,.225,.32,p),
      mapWords: bell(.012,.10,.49,.54,p),
      morph: smooth(.225,.407,p),
      words: bell(.225,.407,.49,.54,p),
      contour: bell(.407, .57, .815, .91, p),
      contourColour: smooth(.62, .67, p),
      flat: smooth(.72, .815, p) * (1 - smooth(.86, .995, p)),
      photo: smooth(.855, .995, p),
      detail: smooth(.885, .995, p),
      stage: p<.012?'absence':p<.225?'semantic-map':p<.407?'morph':p<.54?'word-perimeter':p<.62?'neutral-outline':p<.72?'red-outline':p<.855?'flat-colour':'photograph',
      caption: p < .10 ? 'An idea, before an image.' : p < .225 ? 'A word, and what it holds.' : p < .407 ? 'Meaning finds a shape.' : p < .54 ? 'More than a shape.' : p < .62 ? 'Only an outline.' : p < .72 ? 'The outline takes colour.' : p < .855 ? 'A shape holds its colour.' : p < .97 ? 'Details come into view.' : 'An apple, imagined.'
    };
  }
  // The neutral outline occupies the exact middle of the manual survey.
  const OUTLINE_TIME=playbackTime(.59);
  const sliderSample=progress=>{
    const p=clamp(progress,0,.9);
    const time=p<=.5?p/.5*OUTLINE_TIME:OUTLINE_TIME+(p-.5)/.4*(DURATION-OUTLINE_TIME);
    const phase=sample(playbackProgress(time));
    if(p>=.5)return phase;
    const web=smooth(.01,.09,p),gather=smooth(TENDRIL_START,TENDRIL_ARRIVAL,p);
    return {...phase,semanticMap:web*(1-gather),connections:p<TENDRIL_ARRIVAL?web:0,
      mapWords:web*(1-smooth(TENDRIL_START,.45,p)),words:0,morph:gather,
      contour:p>=TENDRIL_ARRIVAL?1:0,contourColour:0,flat:0,photo:0,detail:0,
      blob:smooth(.10,.18,p)*(1-smooth(.482,.50,p)),blobColour:smooth(.18,.26,p),
      gather,web,stage:p<.01?'absence':p<.10?'semantic-web':p<.18?'grey-blob':p<TENDRIL_START?'colour-blob':p<TENDRIL_ARRIVAL?'gathering-tendrils':'neutral-outline',
      caption:p<.01?'An idea, before an image.':p<.10?'A word and its associations.':p<.18?'A diffuse grey impression.':p<TENDRIL_START?'A diffuse green impression.':p<TENDRIL_ARRIVAL?'Connections gather into an outline.':'Only an outline.'};
  };
  function cubicPoint(curve,t) {
    const u=1-t;
    return [u*u*u*curve[0]+3*u*u*t*curve[2]+3*u*t*t*curve[4]+t*t*t*curve[6],
      u*u*u*curve[1]+3*u*u*t*curve[3]+3*u*t*t*curve[5]+t*t*t*curve[7]];
  }
  function prepareTendrils(loops) {
    // Cover each original edge exactly once, including all small secondary loops.
    // Extra tracks subdivide source links; they never add an independent outline.
    const count=Math.max(SEMANTIC_LINKS.length,loops.length),parts=loops.map(()=>1);
    const lengths=loops.map(loop=>loop.reduce((sum,p,i)=>sum+Math.hypot(p[0]-loop[(i+1)%loop.length][0],p[1]-loop[(i+1)%loop.length][1]),0));
    for(let n=loops.length;n<count;n++){
      let best=0;for(let i=1;i<loops.length;i++)if(lengths[i]/parts[i]>lengths[best]/parts[best])best=i;
      parts[best]++;
    }
    const targets=[];
    loops.forEach((loop,loopIndex)=>{
      for(let part=0;part<parts[loopIndex];part++){
        const start=Math.floor(part*loop.length/parts[loopIndex]),end=Math.floor((part+1)*loop.length/parts[loopIndex]);
        targets.push({loop:loopIndex,start,end,points:Array.from({length:end-start+1},(_,i)=>loop[(start+i)%loop.length])});
      }
    });
    const sourceParts=SEMANTIC_LINKS.map(()=>1);
    for(let n=SEMANTIC_LINKS.length;n<count;n++)sourceParts[(n-SEMANTIC_LINKS.length)%SEMANTIC_LINKS.length]++;
    const sources=SEMANTIC_LINKS.flatMap((link,index)=>Array.from({length:sourceParts[index]},(_,part)=>({link:index,from:part/sourceParts[index],to:(part+1)/sourceParts[index]})));
    // Locality and direction matching keep nearby branches near their destination.
    const tracks=[];
    while(sources.length){
      let best={cost:Infinity};
      sources.forEach((source,si)=>{
        const curve=SEMANTIC_LINKS[source.link].curve,a=cubicPoint(curve,source.from),b=cubicPoint(curve,source.to);
        targets.forEach((target,ti)=>{
          const first=target.points[0],last=target.points.at(-1);
          for(const reverse of [false,true]){
            const x=reverse?last:first,y=reverse?first:last;
            const cost=Math.hypot(a[0]-x[0],a[1]-x[1])+Math.hypot(b[0]-y[0],b[1]-y[1]);
            if(cost<best.cost)best={cost,si,ti,reverse};
          }
        });
      });
      const source=sources.splice(best.si,1)[0],target=targets.splice(best.ti,1)[0];
      const points=best.reverse?target.points.slice().reverse():target.points;
      tracks.push({...source,loop:target.loop,start:target.start,end:target.end,target:points,
        source:points.map((_,i)=>cubicPoint(SEMANTIC_LINKS[source.link].curve,source.from+(source.to-source.from)*i/(points.length-1)))});
    }
    return tracks;
  }
  function tendrilPoint(track,index,amount) {
    const a=track.source[index],b=track.target[index],t=clamp(amount);
    if(t===1)return b;
    return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }
  function blobPixels(size,tint) {
    const pixels=new Uint8ClampedArray(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const nx=x/(size-1),ny=y/(size-1),dx=(nx-.5)/.19,dy=(ny-.54)/.21;
      const cloud=.74*Math.exp(-(dx*dx+dy*dy)*.5)+.18*Math.exp(-(((nx-.39)/.13)**2+((ny-.47)/.16)**2)*.5)+.08*Math.exp(-(((nx-.62)/.12)**2+((ny-.62)/.12)**2)*.5);
      const edge=smooth(0,.08,Math.min(nx,ny,1-nx,1-ny)),i=(y*size+x)*4;
      pixels.set(tint,i);pixels[i+3]=Math.round(93*cloud*edge);
    }
    return pixels;
  }
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({ smoothOutline, sample, sliderSample, clamp, smooth, illustrationColor, makeMotion, wordPose, DURATION, PLAYBACK_KNOTS, playbackProgress, playbackTime, advancePlayback, EDGE_WORDS, SEMANTIC_NODES, SEMANTIC_LINKS, TENDRIL_START, TENDRIL_ARRIVAL, prepareTendrils, tendrilPoint, blobPixels });
  if (!root || !root.document) return;

  const $ = id => document.getElementById(id);
  const canvas = $('apple');
  const BUILD = 'apple-leaves-20261005-1';
  canvas.setAttribute('data-build',BUILD);
  const ctx = canvas.getContext('2d', { alpha: true });
  const slider = $('imagination');
  const sliderControl = $('imagination-control');
  const sliderHandle = $('imagination-handle');
  const sliderFill = $('imagination-fill');
  const play = $('play');
  const replay = $('replay');
  const message = $('load-message');
  const stage = document.querySelector('.apple-stage');
  const renderedUI = { range:null, ariaValue:null, caption:null, playing:null, debug:{} };
  const queryOptions = new URLSearchParams(location.search);
  const debugEnabled = queryOptions.get('debug') === '1';
  const perfEnabled = queryOptions.get('perf') === '1';
  const perfRenderDisabled = perfEnabled && queryOptions.get('render') === '0';
  const glyphCache = new Map();
  const GLYPH_SIZE = 192;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const stats = { frames: 0, pixelPasses: 0, cachedLayers: 0, contourPoints: 0, words: 0 };
  const state = { progress: .5, playing: false, ready: false, hidden: document.hidden, inView: false, reducedMotion: reducedQuery.matches, error: null };
  let raf = 0;
  let lastTime = null;
  let dirty = false;
  let syncRange = true;
  let contourPath;
  let pointerDrag=null;
  let sliderGeometry=null;
  let visualX=null,visualFraction=null;
  let arrivalRequested=false,arrivalConsumed=false,userInteracted=false;
  const playbackListeners=new Set();
  const selectionListeners=new Set();
  const artworkListeners=new Set(),variantRecords=new Map();
  let activeVariant=null;
  let resultsVisible=false;
  let photo, flat, contour, wordTracks, geometry, tendrils, blobs;

  // Opt-in diagnostics: no overlay, sampling or probe frames in normal use.
  const perf = perfEnabled ? {
    ages:[], delays:[], durations:[], intervals:[], handlers:[], errors:[], pending:[], inputs:0, renders:0, expectedX:null,
    pointerDown:false, probe:0, previousFrame:null, lastInput:-Infinity, publishTimer:0
  } : null;
  let perfOutput;
  if(perf) {
    perfOutput=document.createElement('pre');perfOutput.id='apple-perf';
    perfOutput.setAttribute('aria-label','Apple performance diagnostics');
    perfOutput.style.cssText='position:fixed;z-index:99999;right:8px;top:8px;margin:0;padding:10px;background:#000e;color:#fff;font:12px/1.5 monospace;white-space:pre-wrap;pointer-events:none;max-width:calc(100vw - 16px)';
    document.body.appendChild(perfOutput);
    sliderControl.addEventListener('pointerdown',()=>{perf.pointerDown=true;startPerfProbe();});
    const endDrag=()=>{perf.pointerDown=false;publishPerfSoon();};
    root.addEventListener('pointerup',endDrag);
    root.addEventListener('pointercancel',endDrag);
    publishPerf();
  }
  function addPerfSample(list,value) {
    if(!Number.isFinite(value)||value<0)return;
    list.push(value);if(list.length>4000)list.shift();
  }
  function perfSummary(label,list,unit='ms') {
    if(!list.length)return `${label}: n=0`;
    const sorted=list.slice().sort((a,b)=>a-b);
    return `${label}: n=${list.length} p95=${sorted[Math.ceil(sorted.length*.95)-1].toFixed(2)} max=${sorted[sorted.length-1].toFixed(2)} ${unit}`;
  }
  function publishPerf() {
    perf.publishTimer=0;
    perfOutput.textContent=[BUILD,`canvas=${perfRenderDisabled?'OFF (handle-only comparison)':'ON'} inputs=${perf.inputs} renders=${perf.renders}`,
      perfSummary('event age',perf.ages),perfSummary('input → rAF',perf.delays),
      perfSummary('render JS',perf.durations),perfSummary('drag frame interval',perf.intervals),
      perfSummary('pointer handler',perf.handlers),perfSummary('handle alignment',perf.errors,'px'),
      `progress=${state.progress.toFixed(3)} playing=${state.playing} pending=${perf.pending.length}`].join('\n');
  }
  function publishPerfSoon() {
    if(!perf.publishTimer)perf.publishTimer=setTimeout(publishPerf,250);
  }
  function startPerfProbe() {
    if(perf.probe)return;
    perf.previousFrame=null;
    perf.probe=requestAnimationFrame(probePerfFrame);
  }
  function probePerfFrame(now) {
    perf.probe=0;
    if(perf.previousFrame!==null)addPerfSample(perf.intervals,now-perf.previousFrame);
    perf.previousFrame=now;
    // Diagnostic mode only: measure actual laid-out handle centre after input.
    if(perf.expectedX!==null){const box=sliderHandle.getBoundingClientRect();addPerfSample(perf.errors,Math.abs(box.left+box.width/2-perf.expectedX));}
    publishPerfSoon();
    if(!document.hidden&&(perf.pointerDown||performance.now()-perf.lastInput<150))perf.probe=requestAnimationFrame(probePerfFrame);
    else perf.previousFrame=null;
  }
  function recordPerfInput(event) {
    const now=performance.now();
    // Older WebKit reports epoch milliseconds; current engines use timeOrigin.
    let stamp=Number(event.timeStamp);
    if(stamp>1e12)stamp-=performance.timeOrigin;
    addPerfSample(perf.ages,now-stamp);
    perf.pending.push(now);perf.lastInput=now;perf.inputs++;
    startPerfProbe();publishPerfSoon();
  }

  function surface(width = SIZE, height = width) {
    const target = document.createElement('canvas'); target.width = width; target.height = height;
    return target;
  }

  function traceAlpha() {
    // Marching squares runs once, on a small alpha-only copy of the original photograph.
    const grid = surface(240); const g = grid.getContext('2d', { willReadFrequently: true });
    g.drawImage(photo, 0, 0, 240, 240);
    const mask = g.getImageData(0, 0, 240, 240).data; stats.pixelPasses++;
    const edges = new Map();
    const add = (a, b) => {
      const ka = a.join(','), kb = b.join(',');
      if (!edges.has(ka)) edges.set(ka, []);
      if (!edges.has(kb)) edges.set(kb, []);
      edges.get(ka).push(kb); edges.get(kb).push(ka);
    };
    const lookup = { 1:[[3,0]], 2:[[0,1]], 3:[[3,1]], 4:[[1,2]], 5:[[3,0],[1,2]], 6:[[0,2]], 7:[[3,2]], 8:[[2,3]], 9:[[2,0]], 10:[[0,1],[2,3]], 11:[[2,1]], 12:[[1,3]], 13:[[1,0]], 14:[[0,3]] };
    for (let y = 0; y < 239; y++) for (let x = 0; x < 239; x++) {
      const at = (dx, dy) => mask[((y+dy)*240+x+dx)*4+3] > 90 ? 1 : 0;
      const v = at(0,0) + at(1,0)*2 + at(1,1)*4 + at(0,1)*8;
      const points = [[x*2+1,y*2],[x*2+2,y*2+1],[x*2+1,y*2+2],[x*2,y*2+1]];
      for (const [a,b] of lookup[v] || []) add(points[a],points[b]);
    }
    const visited = new Set(); let longest = [];const loops=[];
    for (const start of edges.keys()) {
      if (visited.has(start)) continue;
      const loop = []; let current = start, previous = null;
      while (current && !visited.has(current)) {
        visited.add(current); loop.push(current.split(',').map(Number).map(n=>n*1.5));
        const next = edges.get(current).find(point => point !== previous && (!visited.has(point) || point === start));
        previous = current; current = next;
      }
      if(loop.length>=12)loops.push(smoothOutline(loop));
      if (loop.length > longest.length) longest = loop;
    }
    if (longest.length < 30) throw new Error('The apple image has no usable transparent silhouette.');
    // A short moving average removes raster stair-steps without changing the photograph's geometry.
    const points = smoothOutline(longest);
    const lengths = [0];
    for (let i=1;i<=points.length;i++) { const a=points[i-1], b=points[i%points.length]; lengths.push(lengths[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1])); }
    stats.contourPoints = points.length;
    return { points, lengths, loops, length:lengths[lengths.length-1] };
  }

  function cacheArtwork(image,colour='red') {
    const source = surface(image.naturalWidth||image.width,image.naturalHeight||image.height);
    const sourceContext = source.getContext('2d', { willReadFrequently:true });
    sourceContext.drawImage(image,0,0);
    const pixels = sourceContext.getImageData(0,0,source.width,source.height); stats.pixelPasses++;
    let minX=source.width,minY=source.height,maxX=0,maxY=0;
    for(let y=0;y<source.height;y++) for(let x=0;x<source.width;x++) if(pixels.data[(y*source.width+x)*4+3]>90) {
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
    if(maxX<=minX || maxY<=minY) throw new Error('The apple image is empty.');
    const sourceWidth=maxX-minX+1,sourceHeight=maxY-minY+1;
    const scale=Math.min(590/sourceWidth,620/sourceHeight);
    const width=sourceWidth*scale,height=sourceHeight*scale;
    geometry={ x:(SIZE-width)/2,y:(SIZE-height)/2+8,width,height,source:{x:minX,y:minY,width:sourceWidth,height:sourceHeight} };
    photo=surface();const pg=photo.getContext('2d',{willReadFrequently:true});
    pg.drawImage(image,minX,minY,sourceWidth,sourceHeight,geometry.x,geometry.y,width,height);
    const actual=pg.getImageData(0,0,SIZE,SIZE); stats.pixelPasses++;
    contour=traceAlpha();
    // This exact contour geometry is constant; build its drawing commands once.
    contourPath=new Path2D();
    for(const loop of contour.loops){loop.forEach((q,i)=>i===0?contourPath.moveTo(...q):contourPath.lineTo(...q));contourPath.lineTo(...loop[0]);}

    // Flatten large colour areas from the same image; alpha remains byte-for-byte aligned.
    const blur=surface();const bg=blur.getContext('2d',{willReadFrequently:true});
    bg.filter='blur(15px)';bg.drawImage(photo,0,0);bg.filter='none';
    const softened=bg.getImageData(0,0,SIZE,SIZE); stats.pixelPasses++;
    const illustration=pg.createImageData(SIZE,SIZE);
    for(let i=0;i<actual.data.length;i+=4) {
      const r=softened.data[i],g=softened.data[i+1],b=softened.data[i+2];
      const y=(Math.floor(i/4/SIZE)-geometry.y)/height;
      const x=((i/4)%SIZE-geometry.x)/width;
      const color=illustrationColor(r,g,b,x,y,colour);
      illustration.data.set(color,i);illustration.data[i+3]=actual.data[i+3];
    }
    flat=surface();flat.getContext('2d').putImageData(illustration,0,0);
    stats.cachedLayers=2;
    tendrils=prepareTendrils(contour.loops);
    blobs=[[168,163,150],[151,175,91]].map(tint=>{
      const layer=surface(192),ink=layer.getContext('2d'),pixels=ink.createImageData(192,192);
      pixels.data.set(blobPixels(192,tint));ink.putImageData(pixels,0,0);return layer;
    });
    stats.cachedLayers+=blobs.length;
    // Glyphs retain their complete original pose; only opacity changes.
    wordTracks=SEMANTIC_NODES.map(node=>{
      ctx.font=`${node.size}px Georgia`;
      const sourceWidth=ctx.measureText(node.word).width;
      const letters=Array.from(node.word,(letter,i)=>{
        const offset=-sourceWidth/2+ctx.measureText(node.word.slice(0,i)).width+ctx.measureText(letter).width/2;
        const pose={x:node.x+offset,y:node.y,size:node.size,angle:0};
        return {letter,sprite:cacheGlyph(letter),motion:makeMotion(pose,pose)};
      });
      return {word:node.word,role:node.role,letters};
    });
    stats.words=wordTracks.length;
    stats.glyphTracks=wordTracks.reduce((total,track)=>total+track.letters.length,0);
    stats.semanticLinks=SEMANTIC_LINKS.length;
  }

  function cacheGlyph(letter) {
    if(glyphCache.has(letter))return glyphCache.get(letter);
    ctx.save();ctx.font=`${GLYPH_SIZE}px Georgia`;
    const sprite=surface(Math.ceil(ctx.measureText(letter).width)+32,GLYPH_SIZE+64);
    ctx.restore();
    const ink=sprite.getContext('2d');
    ink.font=`${GLYPH_SIZE}px Georgia`;ink.textAlign='center';ink.textBaseline='middle';ink.fillStyle=WORD_INK;
    ink.fillText(letter,sprite.width/2,sprite.height/2);
    glyphCache.set(letter,sprite);stats.cachedGlyphs=glyphCache.size;
    return sprite;
  }

  function render() {
    if(!state.ready) return;
    const perfStart=perf?performance.now():0;
    const s=sliderSample(state.progress);
    if(!perfRenderDisabled) {
    ctx.clearRect(0,0,SIZE,SIZE);
    ctx.lineCap='round';ctx.lineJoin='round';
    if(s.blob>0){
      // Add complementary premultiplied tints on the cleared canvas: the cloud's
      // alpha and shape stay identical throughout the grey-to-green transition.
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=s.blob*(1-s.blobColour);ctx.drawImage(blobs[0],0,0,SIZE,SIZE);
      ctx.globalAlpha=s.blob*s.blobColour;ctx.drawImage(blobs[1],0,0,SIZE,SIZE);
      ctx.globalCompositeOperation='source-over';
    }
    if(s.flat>.001) {ctx.globalAlpha=s.flat*.79;ctx.drawImage(flat,0,0);}
    const detail=activeVariant?.detailActive&&activeVariant.artwork?.detailPhoto&&state.progress>.9?smooth(.9,.92,state.progress):0;
    if(detail&&root.AppleArtwork.drawFrame){
      const record=activeVariant.artwork,g=record.geometry;
      root.AppleArtwork.drawFrame(record.transitionPhoto.getContext('2d'),activeVariant,detail,undefined,'all');
      ctx.globalAlpha=1;ctx.drawImage(record.transitionPhoto,g.source.x,g.source.y,g.source.width,g.source.height,g.x,g.y,g.width,g.height);
    }else if(s.photo>.001){ctx.globalAlpha=s.photo;ctx.drawImage(detail?activeVariant.artwork.detailPhoto:photo,0,0);}
    if(s.connections>0) {
      const gather=s.gather,style=smooth(0,.8,gather);
      ctx.globalAlpha=s.connections*(.56+.23*style);ctx.strokeStyle='rgb(207,198,180)';ctx.lineWidth=1+.8*style;
      // One combined stroke avoids accumulating alpha at connected track ends.
      ctx.beginPath();
      for(const track of tendrils)track.source.forEach((_,i)=>{
        const point=tendrilPoint(track,i,gather);if(i===0)ctx.moveTo(...point);else ctx.lineTo(...point);
      });
      ctx.stroke();
      const tail=1-smooth(0,.7,gather);
      if(tail>0){
        // The short fruit tail retracts into its root before the contour arrives.
        ctx.beginPath();ctx.moveTo(...cubicPoint(FRUIT_TAIL,0));
        for(let i=1;i<=24;i++)ctx.lineTo(...cubicPoint(FRUIT_TAIL,i/24*tail));
        ctx.globalAlpha=s.connections*.34*tail;ctx.lineWidth=.7*tail;ctx.stroke();
      }
    }
    if(s.contour>.001) {
      const neutral=[207,198,180],red=activeVariant?.colour==='green'?[139,162,81]:[192,67,54];
      const ink=neutral.map((value,index)=>Math.round(value+(red[index]-value)*s.contourColour));
      ctx.lineWidth=1.8;ctx.strokeStyle=`rgb(${ink.join(',')})`;ctx.globalAlpha=s.contour*.79;ctx.stroke(contourPath);
    }
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(const track of wordTracks) {
      const opacity=state.progress<.5?(s.web||0)*(1-smooth(TENDRIL_START,track.role==='center'?.415:.45,state.progress)):0;
      if(opacity<=0)continue;
      for(const letter of track.letters) {
        const pose=letter.motion.from;
        ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);
        ctx.globalAlpha=opacity;
        const scale=pose.size/GLYPH_SIZE;
        const width=letter.sprite.width*scale,height=letter.sprite.height*scale;
        ctx.drawImage(letter.sprite,-width/2,-height/2,width,height);ctx.restore();
      }
    }
    ctx.globalAlpha=1;
    }
    stats.frames++;
    const range=String(Math.round(state.progress*1000));
    if(syncRange&&slider.value!==range)slider.value=range;
    renderedUI.range=range;
    if(!pointerDrag)syncSliderVisual(state.progress);
    const ariaValue=`${Math.round(state.progress*100)} percent. ${s.caption}`;
    if(renderedUI.ariaValue!==ariaValue) {slider.setAttribute('aria-valuetext',ariaValue);renderedUI.ariaValue=ariaValue;}
    if(renderedUI.caption!==s.caption) {
      canvas.setAttribute('aria-label',`Apple visualization. ${s.caption}`);renderedUI.caption=s.caption;
    }
    syncDebug();
    if(perf){perf.renders++;addPerfSample(perf.durations,performance.now()-perfStart);publishPerfSoon();}
  }

  function syncDebug() {
    if(!debugEnabled)return;
    const phase=sliderSample(state.progress);
    for(const [key,value] of Object.entries({stage:phase.stage,'word-labels':EDGE_WORDS.join(','),'label-count':stats.words,'perimeter-only':state.progress>=TENDRIL_ARRIVAL,progress:state.progress.toFixed(5),playing:state.playing,ready:state.ready,'pixel-passes':stats.pixelPasses,frames:stats.frames,'raf-active':Boolean(raf),'reduced-motion':state.reducedMotion,error:state.error||'',words:phase.words.toFixed(5),'map-words':phase.mapWords.toFixed(5),'semantic-map':phase.semanticMap.toFixed(5),morph:phase.morph.toFixed(5),connections:phase.connections.toFixed(5),contour:phase.contour.toFixed(5),'contour-colour':phase.contourColour.toFixed(5),flat:phase.flat.toFixed(5),photo:phase.photo.toFixed(5),blob:(phase.blob||0).toFixed(5),'blob-colour':(phase.blobColour||0).toFixed(5)})) {
      if(renderedUI.debug[key]!==value){canvas.setAttribute(`data-${key}`,String(value));renderedUI.debug[key]=value;}
    }
  }

  function syncControls() {
    if(renderedUI.playing===state.playing)return;
    renderedUI.playing=state.playing;
    play.classList.toggle('is-playing',state.playing);
    $('play-label').textContent=state.playing?'Pause':'Play';
    play.setAttribute('aria-label',state.playing?'Pause animation':'Play animation');
    play.setAttribute('aria-pressed',String(state.playing));
    syncDebug();
    playbackListeners.forEach(listener=>listener());
  }
  // Input updates state immediately. A single pending frame always paints the
  // latest value, without writing back to the browser's native range control.
  function cancelFrame() {if(raf) cancelAnimationFrame(raf);raf=0;lastTime=null;}
  function schedule() {
    if(state.ready&&!state.hidden&&state.inView&&!raf&&(dirty||state.playing))raf=requestAnimationFrame(tick);
  }
  function measureSlider() {
    const bounds=sliderControl.getBoundingClientRect();
    sliderGeometry={left:bounds.left+18,width:Math.max(1,bounds.width-36)};
    return sliderGeometry;
  }
  function syncSliderVisual(progress) {
    const fraction=clamp(progress);
    const x=fraction*(sliderGeometry||measureSlider()).width;
    if(visualX!==x){sliderHandle.style.transform=`translate3d(${x}px,0,0)`;visualX=x;}
    if(visualFraction!==fraction){sliderFill.style.transform=`scaleX(${fraction})`;visualFraction=fraction;}
  }
  function requestRender(writeRange=false) {
    dirty=true;syncRange=writeRange;
    if(writeRange){slider.value=String(Math.round(state.progress*1000));syncSliderVisual(state.progress);}
    schedule();
  }
  function setPlaying(value) {
    const next=Boolean(value)&&state.ready&&!state.hidden&&state.inView&&!perfRenderDisabled;
    if(state.playing!==next)lastTime=null;
    state.playing=next;
    if(!next&&!dirty)cancelFrame();else schedule();
    syncControls();
  }
  function tick(now) {
    raf=0;
    if(state.hidden||!state.inView)return;
    if(state.playing&&state.inView) {
      if(lastTime!==null)state.progress=advancePlayback(state.progress,now-lastTime);
      lastTime=now;dirty=true;syncRange=true;
    }
    if(dirty){
      if(perf){const frameTime=performance.now();for(const received of perf.pending)addPerfSample(perf.delays,frameTime-received);perf.pending.length=0;}
      dirty=false;render();
    }
    if(state.progress>=1&&state.playing)setPlaying(false);
    schedule();
  }
  function setManualProgress(fraction,writeValue) {
    state.progress=clamp(fraction);
    if(writeValue){const value=String(Math.round(state.progress*1000));if(slider.value!==value)slider.value=value;}
    syncSliderVisual(state.progress);
    requestRender(false);
    if(activeVariant?.detailReady)activeVariant.detailActive=true;
    selectionListeners.forEach(listener=>listener());
  }
  function scrub(event) {
    if(perf&&event.type==='input')recordPerfInput(event);
    userInteracted=true;arrivalConsumed=true;setPlaying(false);
    setManualProgress(Number(slider.value)/1000,false);
  }
  document.addEventListener('keydown',event=>{if(event.key==='Tab')sliderControl.classList.toggle('keyboard-focus',true);});
  slider.addEventListener('keydown',()=>sliderControl.classList.toggle('keyboard-focus',true));
  slider.addEventListener('blur',()=>sliderControl.classList.toggle('keyboard-focus',false));
  slider.addEventListener('input',scrub);
  slider.addEventListener('change',scrub);
  // Pointer input has one direct state/visual update. The native input remains
  // the keyboard and assistive-technology control; no synthetic event roundtrip.
  function movePointer(event) {
    if(!pointerDrag||event.pointerId!==pointerDrag.id)return;
    const started=perf?performance.now():0;
    if(event.cancelable)event.preventDefault();
    let latest=event;
    if(event.type==='pointermove'&&typeof event.getCoalescedEvents==='function') {
      const samples=event.getCoalescedEvents();
      const last=samples[samples.length-1];
      if(last&&Number.isFinite(last.clientX))latest=last;
    }
    const fraction=clamp((latest.clientX-sliderGeometry.left)/sliderGeometry.width);
    pointerDrag.fraction=fraction;pointerDrag.clientX=latest.clientX;
    if(perf){recordPerfInput(latest);perf.expectedX=sliderGeometry.left+fraction*sliderGeometry.width;}
    setManualProgress(fraction,true);
    if(perf)addPerfSample(perf.handlers,performance.now()-started);
  }
  function finishPointer(event) {
    if(!pointerDrag||event.pointerId!==pointerDrag.id)return;
    if(event.type==='pointerup')movePointer(event);
    const id=pointerDrag.id;
    pointerDrag=null;
    if(sliderControl.hasPointerCapture(id))sliderControl.releasePointerCapture(id);
  }
  sliderControl.addEventListener('pointerdown',event=>{
    if(slider.disabled||pointerDrag||event.isPrimary===false||event.button!==0)return;
    event.preventDefault();
    sliderControl.classList.toggle('keyboard-focus',false);
    slider.focus({preventScroll:true});
    userInteracted=true;arrivalConsumed=true;setPlaying(false);
    measureSlider();
    pointerDrag={id:event.pointerId,fraction:state.progress,clientX:event.clientX};
    sliderControl.setPointerCapture(event.pointerId);
    movePointer(event);
  });
  sliderControl.addEventListener('pointermove',movePointer,{passive:false});
  sliderControl.addEventListener('pointerup',finishPointer);
  sliderControl.addEventListener('pointercancel',finishPointer);
  sliderControl.addEventListener('lostpointercapture',finishPointer);
  root.addEventListener('resize',()=>{
    measureSlider();
    if(pointerDrag){
      pointerDrag.fraction=clamp((pointerDrag.clientX-sliderGeometry.left)/sliderGeometry.width);
      setManualProgress(pointerDrag.fraction,true);
    }else syncSliderVisual(state.progress);
    if(perf)perf.expectedX=null;
  },{passive:true});
  // This is a manual survey: arriving, revisiting and public playback controls
  // cannot advance or reset the chosen answer.
  function attemptArrival() {}
  root.appleExperience=Object.freeze({
    get ready(){return state.ready;},get playing(){return false;},
    get value(){return Math.round(state.progress*1000);},
    get hasSelection(){return userInteracted;},
    get resultsVisible(){return resultsVisible;},
    get colour(){return activeVariant?.colour||'green';},
    get artwork(){return activeVariant;},
    // Retain compatibility with old callers without changing the green artwork.
    setColour(){},
    get artworks(){return Array.from(variantRecords.values());},
    onArtwork(listener){artworkListeners.add(listener);listener(activeVariant);return ()=>artworkListeners.delete(listener);},
    setResultsVisible(value){if(resultsVisible===Boolean(value))return;resultsVisible=Boolean(value);playbackListeners.forEach(listener=>listener());},
    arrive(){}, toggle(){},
    subscribe(listener){playbackListeners.add(listener);listener();return ()=>playbackListeners.delete(listener);},
    onSelection(listener){selectionListeners.add(listener);return ()=>selectionListeners.delete(listener);}
  });
  const visibilityObserver = new IntersectionObserver(entries=>{
    state.inView=entries[0].isIntersecting;
    if(!state.inView){if(arrivalRequested)arrivalConsumed=true;setPlaying(false);cancelFrame();}else{schedule();attemptArrival();}
    syncDebug();
  }, {threshold:0});
  visibilityObserver.observe(stage);
  document.addEventListener('visibilitychange',()=>{
    state.hidden=document.hidden;
    if(state.hidden){if(arrivalRequested)arrivalConsumed=true;setPlaying(false);cancelFrame();}else schedule();
    syncDebug();
  });
  reducedQuery.addEventListener('change',event=>{state.reducedMotion=event.matches;if(event.matches)setPlaying(false);});
  root.awfSnapshot=()=>JSON.parse(JSON.stringify({ ...state, duration:DURATION, phase:sliderSample(state.progress), geometry, stats, rafActive:Boolean(raf) }));

  function install(record){({photo,flat,contour,contourPath,wordTracks,geometry,tendrils,blobs}=record);}
  function capture(){return {photo,flat,contour,contourPath,wordTracks,geometry,tendrils,blobs};}
  function prepared(variant){
    const previous=capture();
    try{cacheArtwork(variant.base,variant.colour);variant.artwork=capture();variantRecords.set(variant.colour,variant);}
    finally{install(previous);}
    return variant;
  }
  function activate(variant){
    const changed=activeVariant!==variant;
    activeVariant=variant;install(variant.artwork);
    if(changed&&variant.detailReady)variant.detailActive=true;
    if(!state.ready){
      state.ready=true;stage.setAttribute('aria-busy','false');message.hidden=true;
      slider.disabled=false;play.disabled=false;replay.disabled=false;
      const query=new URLSearchParams(location.search),requested=query.get('stage');
      const fixed=requested!==null&&requested.trim()!==''&&Number.isFinite(Number(requested));state.progress=fixed?clamp(Number(requested)):.5;
    }
    // Display changes never enter the manual-selection path or touch results.
    if(changed){render();dirty=false;cancelFrame();}
    else if(variant.detailActive){dirty=true;schedule();}
    artworkListeners.forEach(listener=>listener(activeVariant));
    playbackListeners.forEach(listener=>listener());
  }
  function fail(error) {
    state.error=error.message;state.ready=false;slider.disabled=true;stage.setAttribute('aria-busy','false');message.hidden=false;
    message.textContent='The apple could not be loaded. Please refresh to try again.';syncDebug();console.error('AWF artwork:',error);
  }
  if(root.AppleArtwork){
    // Green is the only display mode, including browsers with a saved Red choice.
    const base=root.AppleArtwork.loadBase('green').then(prepared);
    base.then(activate,fail);
    // Optional details start after the base has made the manual slider usable.
    base.then(variant=>root.AppleArtwork.loadDetail(variant)).then(variant=>{
      const record=variant.artwork;if(!record)return;
      const g=record.geometry,c=surface(),ctx=c.getContext('2d');
      const endpoint=root.AppleModel?.endpoint(variant,'all')||variant.detail;
      ctx.drawImage(endpoint,g.source.x,g.source.y,g.source.width,g.source.height,g.x,g.y,g.width,g.height);record.detailPhoto=c;
      record.transitionPhoto=surface(variant.base.width,variant.base.height);
      if(activeVariant===variant&&state.progress<=.9)variant.detailActive=true;
      artworkListeners.forEach(listener=>listener(activeVariant));
    }).catch(()=>{});
  }else{
    // A static source remains usable when an optional renderer script is absent.
    const image=new Image();image.onload=()=>{try{const variant=prepared({colour:'green',base:image,baseId:'green-hyperreal-fallback',detailReady:false});activate(variant);}catch(error){fail(error);}};
    image.onerror=()=>fail(Error('Unable to load the apple image.'));image.src='assets/apple-green-hyperreal-v1.png';
  }
})(typeof window==='object'?window:null);
