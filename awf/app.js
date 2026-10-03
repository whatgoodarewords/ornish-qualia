(function () {
  'use strict';
  const EVENT_NAMES=Object.freeze([
    {id:'world-aphantasia-week',label:'World Aphantasia Week',bounds:[156,121,2046,626]},
    {id:'aphantasia-world-forum',label:'Aphantasia World Forum',bounds:[101,100,2089,619]},
    {id:'there-is-no-apple',label:'THERE IS NO APPLE',bounds:[248,105,1899,628]},
    {id:'there-is-no-apple-lowercase',label:'there is no apple',bounds:[445,93,1727,634]},
    {id:'aphantasia-anonymous',label:'Aphantasia Anonymous',bounds:[68,72,2114,626]},
    {id:'aphantasia-research-camp',label:'Aphantasia Research Camp',bounds:[80,90,2113,623]}
  ]);
  function createNameSelector({canvas,fallback,fallbackText,heading,choices,status,read,save,makeImage}){
    const defaultName='there-is-no-apple-lowercase',records=new Map(EVENT_NAMES.map(name=>[name.id,name])),images=new Map(),ctx=canvas.getContext('2d');
    let active=defaultName,request=0;
    const check=id=>choices.forEach(choice=>{choice.checked=choice.value===id;});
    const announce=text=>{status.textContent=text;status.hidden=!text;};
    function load(id){
      if(!images.has(id))images.set(id,new Promise((resolve,reject)=>{
        const image=makeImage();image.onload=async()=>{try{if(image.decode)await image.decode();resolve(image);}catch(error){reject(error);}};image.onerror=()=>reject(Error('Wordmark unavailable'));image.src=`assets/wordmarks-v1/${id}.png`;
      }).catch(error=>{images.delete(id);throw error;}));
      return images.get(id);
    }
    function display(id,image){
      const name=records.get(id),[left,top,right,bottom]=name.bounds,x=left-8,y=top-8,width=right-left+16,height=bottom-top+16,scale=Math.min(canvas.width/width,canvas.height/height);
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,x,y,width,height,(canvas.width-width*scale)/2,(canvas.height-height*scale)/2,width*scale,height*scale);
      canvas.hidden=false;fallback.setAttribute('hidden','');fallbackText.hidden=true;heading.textContent=name.label;active=id;
    }
    function textFallback(){if(canvas.hidden){fallback.setAttribute('hidden','');fallbackText.hidden=false;fallbackText.textContent=records.get(active).label;}}
    function choose(value,persist=true){
      const id=records.has(value)?value:defaultName,version=++request;check(id);announce(`Loading ${records.get(id).label}…`);
      load(id).then(image=>{
        if(version!==request)return;display(id,image);check(id);announce('');if(persist)try{save(id);}catch{}
      },()=>{if(version!==request)return;check(active);textFallback();announce(`That wordmark could not be loaded. Keeping ${records.get(active).label}.`);});
    }
    let preferred;try{preferred=read();}catch{}if(!records.has(preferred))preferred=defaultName;
    // A decoded default also supplies the visible fallback during a slow saved choice.
    if(preferred!==defaultName)load(defaultName).then(image=>{if(canvas.hidden&&active===defaultName)display(defaultName,image);},textFallback);
    for(const choice of choices)choice.addEventListener('change',()=>{if(choice.checked)choose(choice.value);});
    choose(preferred,false);
    return {get active(){return active;}};
  }
  function wireQuestions(disclosure,document){
    if(!disclosure)return;
    disclosure.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&disclosure.open){event.preventDefault();disclosure.open=false;disclosure.querySelector('summary').focus();}
    });
    document.addEventListener('pointerdown',event=>{if(disclosure.open&&!disclosure.contains(event.target))disclosure.open=false;});
  }
  function paintingGeometry(width,height,position=[.5,.5]){
    // The original bitmap is the coordinate system in both compositions.
    const scale=Math.max(width/1561,height/1008),offsetX=(width-1561*scale)*position[0],offsetY=(height-1008*scale)*position[1];
    const extensionScale=scale/.748,shoeY=offsetY+1034*extensionScale;
    return {scale,offsetX,offsetY,faceX:offsetX+778*scale,faceY:offsetY+389*scale,hatY:offsetY+267*scale,
      groinY:offsetY+910*scale,originalWidth:1561*scale,originalHeight:1008*scale,
      extensionWidth:1024*extensionScale,extensionHeight:1536*extensionScale,shoeY,
      runwayHeight:Math.max(height,shoeY+Math.max(48,Math.min(90,height*.09)))};
  }
  function handTurnDuration(wristY,viewportHeight){
    // Give the welcome more time, retaining a visible cuff at its held endpoint.
    return Math.max(1,Math.min((wristY-viewportHeight*.3)*1.3,wristY-Math.max(48,viewportHeight*.12)));
  }
  function landingPose(g,artwork,{progress,y,viewportHeight,appleHandle}){
    const p=Math.max(0,Math.min(1,progress)),mix=(a,b)=>a+(b-a)*p;
    // A single scroll interval owns position and scale. There is no waypoint
    // at the groin to restart easing, cancel scroll velocity or hold the fruit.
    const size=appleHandle?mix(g.scale,.7):g.scale;
    const x=(g.centerX??g.faceX)-artwork.fruitX*size;
    const end=g.end??y;
    const finalPivot=appleHandle?Math.min(g.targetY-end,viewportHeight-(artwork.height-artwork.fruitY)*.7-12):viewportHeight+24+artwork.fruitY*g.scale;
    return {size,x,top:mix(g.faceY,finalPivot)-artwork.fruitY*size};
  }
  function appleClipBottom(pose,artwork,introTop,scrollY){
    return introTop==null?0:Math.max(0,Math.min(artwork.height,artwork.height-(introTop-scrollY-pose.top)/pose.size));
  }
  if(typeof module==='object'&&module.exports)module.exports={landingPose,paintingGeometry,handTurnDuration,appleClipBottom,EVENT_NAMES,createNameSelector,wireQuestions};
  if(typeof document==='undefined')return;
  const root=document.documentElement;
  const runway=document.querySelector('.hero-runway');
  const hero=document.querySelector('.hero');
  const art=document.querySelector('.hero-art');
  const title=document.querySelector('.hero-title');
  const apple=document.querySelector('.scroll-apple');
  const nav=document.querySelector('.navigation');
  const section=document.getElementById('imagine');
  const gathering=document.getElementById('gathering-intro');
  const dock=document.getElementById('imagination-handle');
  const options=document.getElementById('site-options');
  const handleToggle=document.getElementById('apple-handle-toggle');
  const roadToggle=document.getElementById('road-scene-toggle');
  const roadPainting=document.querySelector('.road-painting');
  if(!runway||!hero||!art||!apple||!section||!dock)return;
  const scene=apple.querySelector('svg'),bounds=scene.viewBox.baseVal;
  const artwork={width:66,height:74,fruitX:(Number(scene.dataset.fruitX)-bounds.x)/bounds.width*66,fruitY:(Number(scene.dataset.fruitY)-bounds.y)/bounds.height*74};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,p)=>a+(b-a)*p;
  let appleHandle=true;
  const handleScale=.7;
  function readPreference(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
  function savePreference(key,value){try{localStorage.setItem(key,value);}catch{}}
  const handleArt=scene.cloneNode(true);
  handleArt.classList.add('handle-apple');
  handleArt.querySelector('clipPath').id='magritte-handle-clip';
  handleArt.querySelector('image').setAttribute('clip-path','url(#magritte-handle-clip)');
  handleArt.style.width=`${artwork.width*handleScale}px`;
  handleArt.style.height=`${artwork.height*handleScale}px`;
  handleArt.style.left=`${18-artwork.fruitX*handleScale}px`;
  handleArt.style.top=`${18-artwork.fruitY*handleScale}px`;
  dock.appendChild(handleArt);
  appleHandle=readPreference('awf-apple-handle','true')!=='false';
  handleToggle.checked=appleHandle;
  root.classList.toggle('apple-handle-mode',appleHandle);
  const nameCanvas=document.getElementById('event-wordmark');
  if(nameCanvas)createNameSelector({canvas:nameCanvas,fallback:document.getElementById('event-wordmark-fallback'),fallbackText:document.getElementById('event-wordmark-text'),heading:document.getElementById('event-name-label'),choices:Array.from(document.querySelectorAll('input[name="event-name"]')),status:document.getElementById('event-name-status'),read:()=>readPreference('awf-event-name','there-is-no-apple-lowercase'),save:value=>savePreference('awf-event-name',value),makeImage:()=>new Image()});
  wireQuestions(document.getElementById('site-questions'),document);
  options.hidden=false;
  options.addEventListener('keydown',event=>{if(event.key==='Escape'){options.open=false;options.querySelector('summary').focus();}});
  document.addEventListener('pointerdown',event=>{if(options.open&&!options.contains(event.target))options.open=false;});
  let layout,frame=0,needsMeasure=true,inspectHash=true,previousY=window.scrollY;
  let roadRequested=readPreference('awf-scene','road')!=='original',roadAvailable=true,road=false,roadAttempt=0,sceneAnchor=null;
  let forceDock=Boolean(location.hash&&location.hash!=='#top'&&location.hash!=='#gathering-intro'),journey=false,docked=false,connected=false,arrived=false;
  const written=new WeakMap();
  function style(node,key,value){let cache=written.get(node);if(!cache){cache={};written.set(node,cache);}if(cache[key]!==value){node.style[key]=value;cache[key]=value;}}
  function attribute(node,key,value){if(node.getAttribute(key)!==String(value))node.setAttribute(key,String(value));}
  function connect(){if(!connected&&window.appleExperience){connected=true;window.appleExperience.subscribe(()=>{needsMeasure=true;schedule();});window.appleExperience.onSelection(()=>{if(!docked){needsMeasure=true;schedule();}});if(arrived)window.appleExperience.arrive();}}
  function configure(){root.classList.add('site-enhanced');root.classList.toggle('hero-scroll-active',!reduced.matches);needsMeasure=true;schedule();}
  function chooseScene(){
    const next=roadRequested&&roadAvailable;
    if(next!==road&&layout&&window.scrollY>0&&(docked||window.scrollY>=layout.sectionTop))sceneAnchor=section.getBoundingClientRect().top;
    road=next;
    root.dataset.scene=road?'road':'original';
    roadPainting.hidden=!road;roadToggle.checked=road;
    art.alt=road?'A man in a bowler hat with a completely featureless face, standing in black dress shoes on a charcoal road before the sea beneath an expansive painted sky.':'A man in a bowler hat with a completely featureless face, standing before the sea beneath an expansive painted sky.';
    needsMeasure=true;schedule();
  }
  roadToggle.addEventListener('change',()=>{
    roadRequested=roadToggle.checked;savePreference('awf-scene',roadRequested?'road':'original');
    if(roadRequested&&!roadAvailable)loadRoadArtwork();
    chooseScene();
  });
  function roadUnavailable(){
    roadAvailable=false;roadToggle.title='Road artwork unavailable; turn on to try again';chooseScene();
  }
  // A broken decorative image must not strand the scene in an empty layout.
  function loadRoadArtwork(){
    const attempt=++roadAttempt;let remaining=2,failed=false;
    roadToggle.setAttribute('aria-busy','true');
    for(const source of ['assets/hero-road-v1.png','assets/asphalt-v1.png']){
      const image=new Image();
      image.addEventListener('error',()=>{if(attempt!==roadAttempt)return;failed=true;roadToggle.removeAttribute('aria-busy');roadUnavailable();});
      image.addEventListener('load',()=>{
        if(attempt!==roadAttempt)return;
        if(--remaining===0&&!failed){roadAvailable=true;roadToggle.title='';roadToggle.removeAttribute('aria-busy');chooseScene();}
      });
      image.src=source;
    }
  }
  loadRoadArtwork();
  chooseScene();
  function measure(){
    const navHeight=nav.getBoundingClientRect().height;
    root.style.setProperty('--nav-height',`${navHeight}px`);
    const y=window.scrollY,box=hero.getBoundingClientRect();
    const position=getComputedStyle(art).objectPosition.split(' ').map(v=>parseFloat(v)/100);
    const geometry=paintingGeometry(box.width,box.height,position),{scale,offsetY,hatY}=geometry;
    if(road){
      for(const [key,value] of Object.entries({
        '--painting-width':geometry.originalWidth,'--painting-top':offsetY,'--original-height':geometry.originalHeight,
        '--extension-width':geometry.extensionWidth,'--extension-height':geometry.extensionHeight,
        '--road-height':geometry.runwayHeight,'--original-blend':940*scale,'--road-shoes':1034/.748*scale,
        '--road-fade-start':1120/.748*scale,'--road-fade-end':1380/.748*scale,'--road-grain':780*scale
      }))root.style.setProperty(key,`${value}px`);
    }
    window.paintedHands?.setLayout({scale,offsetX:geometry.offsetX,offsetY,road});
    const wrapper=runway.getBoundingClientRect(),target=dock.getBoundingClientRect(),sectionBox=section.getBoundingClientRect();
    const faceX=box.left+geometry.faceX;
    // Keep the complete wordmark above the painted hat as the cover crop changes.
    const fitWidth=Math.max(1,(hatY-24)*801/270);
    root.style.setProperty('--logo-fit-width',`${fitWidth}px`);
    const titleHeight=title.getBoundingClientRect().height;
    const preferredTop=box.height*(window.innerWidth<=600?.11:.08);
    root.style.setProperty('--title-top',`${Math.max(12,Math.min(preferredTop,hatY-titleHeight-12))}px`);
    const start=wrapper.top+y,run=road?Math.min(box.height*.38,Math.max(1,wrapper.height-box.height)):Math.max(0,wrapper.height-box.height);
    layout={start,run,road,handTop:offsetY+838*scale,handBottom:offsetY+954*scale,handTurnRun:handTurnDuration(offsetY+850*scale,window.innerHeight),faceX,centerX:box.left+box.width/2,faceY:geometry.faceY,groinY:road?geometry.groinY:Math.min(box.height-48,geometry.groinY),scale:2.3*scale,
      targetX:target.left+target.width/2,targetY:target.top+y+target.height/2,targetWidth:target.width,targetHeight:target.height,
      navHeight,sectionTop:sectionBox.top+y,introTop:gathering?gathering.getBoundingClientRect().top+y:null,end:Math.min(Math.max(0,root.scrollHeight-window.innerHeight),Math.max(start+run+1,sectionBox.top+y-navHeight))};
    if(sceneAnchor!==null){window.scrollTo({top:Math.max(0,y+sectionBox.top-sceneAnchor),behavior:'instant'});sceneAnchor=null;}
    needsMeasure=false;
  }
  function setDocked(value){
    if(docked===value)return;
    docked=value;root.classList.toggle('experience-arrived',value);
    if(value){apple.classList.remove('is-over-painting');style(apple,'visibility','hidden');style(apple,'willChange','auto');style(apple,'pointerEvents','none');attribute(apple,'aria-hidden',true);apple.inert=true;apple.disabled=true;apple.tabIndex=-1;}
    else{apple.disabled=false;style(apple,'willChange','transform');}
  }
  function paint(){
    frame=0;connect();if(needsMeasure)measure();
    if(inspectHash){inspectHash=false;redirectHiddenHash();}
    const g=layout,y=window.scrollY;
    if(y<g.start+1&&(previousY>y||!location.hash)){forceDock=false;if(previousY>y)journey=false;}
    previousY=y;
    const navVisible=!nav.hidden&&y>=g.sectionTop-g.navHeight-1;
    nav.classList.toggle('is-visible',navVisible);nav.inert=!navVisible;attribute(nav,'aria-hidden',!navVisible);
    const natural=y>=g.end-1;
    setDocked(natural||forceDock||reduced.matches);
    const dockVisible=g.targetY-y>=g.navHeight&&g.targetY-y+g.targetHeight<=window.innerHeight;
    if(docked&&dockVisible&&!arrived){arrived=true;window.appleExperience?.arrive();}
    if(natural)journey=false;
    // Hands finish while the wrists remain in view, independently of the apple.
    const handHostTop=g.start-y+(g.road?0:Math.max(0,Math.min(g.run,y-g.start)));
    window.paintedHands?.update(clamp((y-g.start)/g.handTurnRun),handHostTop+g.handBottom>0&&handHostTop+g.handTop<window.innerHeight);
    if(docked){window.fallingAppleSpin?.update(1,false);return;}
    const returning=Boolean(window.appleExperience?.hasSelection);
    root.classList.toggle('returning-selection',returning);
    const progress=clamp((y-g.start)/Math.max(1,g.end-g.start));
    const {size,x,top}=landingPose(g,artwork,{progress,y,viewportHeight:window.innerHeight,appleHandle:appleHandle&&!returning});
    // Let the new section occlude the apple at its boundary, before any text.
    // The scroll-driven trajectory, rotation and eventual survey arrival continue.
    const clipped=appleClipBottom({top,size},artwork,g.introTop,y);
    style(apple,'clipPath',clipped>0?`inset(0 0 ${clipped}px 0)`:'none');
    const visible=top+artwork.height*size>0&&top<window.innerHeight&&clipped<artwork.height;
    window.fallingAppleSpin?.update(clamp((y-g.start)/Math.max(1,g.end-g.start)),visible);
    if(visible)style(apple,'transform',`translate3d(${x}px,${top}px,0) scale(${size})`);
    style(apple,'visibility',visible?'visible':'hidden');
    const overPainting=y<=g.start+g.run;
    apple.classList.toggle('is-over-painting',overPainting);
    const interactive=visible&&y<=g.start+8;
    style(apple,'pointerEvents',interactive?'auto':'none');
    attribute(apple,'aria-hidden',!interactive);apple.inert=!interactive;
    apple.tabIndex=interactive?0:-1;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
  function beginJourney(event){if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;journey=true;forceDock=false;schedule();}
  apple.addEventListener('click',event=>{if(docked)return;beginJourney(event);section.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});});
  document.querySelector('.explore-link')?.addEventListener('click',beginJourney);
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',()=>{needsMeasure=true;schedule();},{passive:true});
  window.addEventListener('pageshow',()=>{needsMeasure=true;inspectHash=true;schedule();});
  function redirectHiddenHash(){
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return false;}
    if(!id||!document.getElementById(id)?.closest('[hidden]'))return false;
    history.replaceState(null,'','#imagine');journey=false;forceDock=true;
    section.scrollIntoView({behavior:'instant',block:'start'});schedule();return true;
  }
  window.addEventListener('hashchange',()=>{if(redirectHiddenHash())return;if(location.hash!=='#imagine')journey=false;forceDock=Boolean(location.hash&&location.hash!=='#top'&&location.hash!=='#gathering-intro'&&!journey);schedule();});
  section.addEventListener('focusin',event=>{if(journey&&(event.target===section||event.target===dock))return;journey=false;forceDock=true;schedule();});
  handleToggle.addEventListener('change',()=>{appleHandle=handleToggle.checked;savePreference('awf-apple-handle',String(appleHandle));root.classList.toggle('apple-handle-mode',appleHandle);needsMeasure=true;schedule();});
  reduced.addEventListener('change',configure);
  if(document.fonts)document.fonts.ready.then(()=>{needsMeasure=true;schedule();});
  new ResizeObserver(()=>{needsMeasure=true;schedule();}).observe(document.getElementById('imagination-control'));
  configure();
})();
