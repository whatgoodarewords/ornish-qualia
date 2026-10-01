(function () {
  'use strict';
  const root=document.documentElement;
  const runway=document.querySelector('.hero-runway');
  const hero=document.querySelector('.hero');
  const art=document.querySelector('.hero-art');
  const apple=document.querySelector('.scroll-apple');
  const nav=document.querySelector('.navigation');
  const section=document.getElementById('imagine');
  const dock=document.getElementById('apple-dock');
  if(!runway||!hero||!art||!apple||!section||!dock)return;
  const scene=apple.querySelector('svg'),bounds=scene.viewBox.baseVal;
  const artwork={width:66,height:74,fruitX:(Number(scene.dataset.fruitX)-bounds.x)/bounds.width*66,fruitY:(Number(scene.dataset.fruitY)-bounds.y)/bounds.height*74};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,p)=>a+(b-a)*p;
  const ease=p=>p*p*(3-2*p);
  let layout,frame=0,needsMeasure=true,inspectHash=true,previousY=window.scrollY;
  let forceDock=Boolean(location.hash&&location.hash!=='#top'),journey=false,docked=false,connected=false,arrived=false;
  const written=new WeakMap();
  function style(node,key,value){let cache=written.get(node);if(!cache){cache={};written.set(node,cache);}if(cache[key]!==value){node.style[key]=value;cache[key]=value;}}
  function attribute(node,key,value){if(node.getAttribute(key)!==String(value))node.setAttribute(key,String(value));}
  function connect(){if(!connected&&window.appleExperience){connected=true;if(arrived)window.appleExperience.arrive();}}
  function configure(){root.classList.add('site-enhanced');root.classList.toggle('hero-scroll-active',!reduced.matches);needsMeasure=true;schedule();}
  function measure(){
    const navHeight=nav.getBoundingClientRect().height;
    root.style.setProperty('--nav-height',`${navHeight}px`);
    const y=window.scrollY,box=hero.getBoundingClientRect(),wrapper=runway.getBoundingClientRect(),target=dock.getBoundingClientRect(),sectionBox=section.getBoundingClientRect();
    const position=getComputedStyle(art).objectPosition.split(' ').map(v=>parseFloat(v)/100);
    const scale=Math.max(box.width/1561,box.height/1008);
    const faceX=box.left+(box.width-1561*scale)*(position[0]||0)+778*scale;
    const offsetY=(box.height-1008*scale)*(position[1]||0);
    const start=wrapper.top+y,run=Math.max(0,wrapper.height-box.height);
    layout={start,run,faceX,faceY:offsetY+389*scale,groinY:Math.min(box.height-48,offsetY+910*scale),scale:2.3*scale,
      targetX:target.left,targetY:target.top+y,targetWidth:target.width,targetHeight:target.height,
      navHeight,sectionTop:sectionBox.top+y,end:Math.min(Math.max(0,root.scrollHeight-window.innerHeight),Math.max(start+run+1,sectionBox.top+y-navHeight))};
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
    const travel=clamp((y-g.start-g.run)/Math.max(1,g.end-g.start-g.run));
    const natural=y>=g.end-1;
    setDocked(natural||forceDock||reduced.matches);
    const dockVisible=g.targetY-y>=g.navHeight&&g.targetY-y+g.targetHeight<=window.innerHeight;
    if(docked&&dockVisible&&!arrived){arrived=true;window.appleExperience?.arrive();}
    if(natural)journey=false;
    if(docked)return;
    const first=ease(clamp((y-g.start)/Math.max(1,g.run))),second=ease(travel);
    const size=g.scale;
    const x=g.faceX-artwork.fruitX*size;
    const top=mix(mix(g.faceY,g.groinY,first)-artwork.fruitY*size,window.innerHeight+24,second);
    const visible=top+artwork.height*size>0&&top<window.innerHeight;
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
  window.addEventListener('hashchange',()=>{if(redirectHiddenHash())return;if(location.hash!=='#imagine')journey=false;forceDock=Boolean(location.hash&&location.hash!=='#top'&&!journey);schedule();});
  section.addEventListener('focusin',event=>{if(journey&&(event.target===section||event.target===dock))return;journey=false;forceDock=true;schedule();});
  reduced.addEventListener('change',configure);
  if(document.fonts)document.fonts.ready.then(()=>{needsMeasure=true;schedule();});
  new ResizeObserver(()=>{needsMeasure=true;schedule();}).observe(dock);
  configure();
})();
