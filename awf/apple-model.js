(function(root){
  'use strict';
  // @see https://github.com/whatgoodarewords/awf/issues/3
  const artwork=typeof module==='object'&&module.exports?require('./apple-artwork.js'):root.AppleArtwork;
  const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
  function stage(colour,value,detail=true){return {detail:colour==='green'?detail?smooth((value-900)/20):0:1,shape:colour==='green'?detail?smooth((value-920)/20):0:smooth((value-900)/40)};}
  function bounds(points){return {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};}
  function buildGeometry(variant,pixels){
    const w=variant.base.naturalWidth||variant.base.width,h=variant.base.naturalHeight||variant.base.height,green=variant.colour==='green';
    let parts;
    if(green)parts=artwork.greenParts.map(part=>part.map(([x,y])=>[x*w/198,y*h/218]));
    else{
      const right=[],left=[];
      for(let y=Math.floor(h*.125);y<h;y++){
        let lo=w,hi=-1;for(let x=0;x<w;x++){const k=(y*w+x)*4;if(pixels[k+3]>150&&pixels[k]>pixels[k+1]*1.1&&!(y<h*.25&&x>w*.48&&x<w*.57)){lo=Math.min(lo,x);hi=Math.max(hi,x);}}
        if(hi-lo>w*.05){left.push([lo,y]);right.push([hi,y]);}
      }
      const body=left.length?[...right,...left.reverse()]:Array.from({length:128},(_,i)=>{const a=i/128*Math.PI*2;return [w*(.49+.42*Math.cos(a)),h*(.54+.4*Math.sin(a))];});
      parts=[body,[[.55,.09],[.58,.079],[.605,.053],[.642,.048],[.68,.059],[.715,.095],[.747,.152],[.727,.163],[.68,.15],[.628,.112],[.58,.097]].map(([x,y])=>[x*w,y*h])];
      const leafPixels=[];
      for(let y=0;y<h*.18;y+=2)for(let x=Math.floor(w*.56);x<w*.77;x+=2){const k=(y*w+x)*4;if(pixels[k+3]>150&&pixels[k+1]>pixels[k]*.72&&pixels[k+1]>pixels[k+2]*1.1)leafPixels.push([x-1,y-1],[x+2,y+2]);}
      if(leafPixels.length>10){
        leafPixels.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
        const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=list=>{const hull=[];for(const p of list){while(hull.length>1&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}return hull;};
        const lower=half(leafPixels),upper=half(leafPixels.slice().reverse());parts[1]=[...lower.slice(0,-1),...upper.slice(0,-1)];
      }

    }
    const box=bounds(parts[0]),cx=(box.left+box.right)/2,cy=(box.top+box.bottom)/2,bw=box.right-box.left,bh=box.bottom-box.top;
    const vertices=[],indices=[],groups=[];
    // position, source UV, normal, material UV, part kind, exact flat position.
    const add=(p,uv,kind,local=uv,flat=p)=>{const id=vertices.length/13;vertices.push(...p,...uv,0,0,0,...local,kind,flat[0],flat[1]);return id;};
    const tri=(a,b,c)=>indices.push(a,b,c);
    const begin=()=>indices.length,end=(kind,start)=>groups.push({kind,offset:start,count:indices.length-start});
    // Round the body in depth around its original outline. Both hemispheres
    // share that outline, and every vertex keeps its source x/y coordinates.
    let outline=parts[0].slice();
    if(outline.reduce((n,p,i)=>{const q=outline[(i+1)%outline.length];return n+p[0]*q[1]-q[0]*p[1];},0)<0)outline.reverse();
    // The photograph can contain thousands of raster boundary points; retain
    // a bounded, uniformly sampled outline before generating the surface.
    if(outline.length>256)outline=Array.from({length:256},(_,i)=>outline[Math.floor(i*outline.length/256)]);
    // The painted crown has a tangent corner. Carrying it through every
    // concentric ring creates a long groove; round only the interior rings,
    // returning to the untouched source contour at the outer boundary.
    const crown=outline.map((q,i)=>{
      let x=0,y=0,total=0;
      for(let k=-8;k<=8;k++){const weight=Math.exp(-k*k/32),p=outline[(i+k+outline.length)%outline.length];x+=p[0]*weight;y+=p[1]*weight;total+=weight;}
      const amount=green?1-smooth(((q[1]-box.top)/bh-.1)/.2):0;
      return [q[0]+(x/total-q[0])*amount,q[1]+(y/total-q[1])*amount];
    });
    let start=begin();const rings=40,sides=outline.length,body=[[],[]],rim=[];
    for(let side=0;side<2;side++)for(let j=0;j<=rings;j++){
      const radius=Math.sin(j/rings*Math.PI/2);body[side][j]=[];
      for(let i=0;i<(j===0?1:sides);i++){
        if(side===1&&j===rings){body[side][j].push(rim[i]);continue;}
        const edge=smooth((radius-.9)/.1),q=outline[i].map((v,k)=>crown[i][k]+(v-crown[i][k])*edge),x=cx+(q[0]-cx)*radius,y=cy+(q[1]-cy)*radius,z=(side===0?1:-1)*bw*.475*Math.cos(j/rings*Math.PI/2);
        const longitude=(Math.atan2(z,x-cx)/(Math.PI*2)+1)%1;
        const id=add([x,y,j===rings?0:z],[x/w,y/h],0,[longitude,(y-box.top)/bh],[x,y]);
        body[side][j].push(id);if(j===rings)rim.push(id);
      }
    }
    for(let side=0;side<2;side++){
      const face=(a,b,c)=>side===0?tri(a,b,c):tri(a,c,b);
      for(let i=0;i<sides;i++)face(body[side][0][0],body[side][1][i],body[side][1][(i+1)%sides]);
      for(let j=1;j<rings;j++)for(let i=0;i<sides;i++){const k=(i+1)%sides,a=body[side][j][i],b=body[side][j][k],c=body[side][j+1][i],d=body[side][j+1][k];face(a,c,b);face(b,c,d);}
    }
    end('body',start);
    // Query the generated front triangles, rather than an analytic surrogate:
    // the leaves and petioles must clear the surface that is actually drawn.
    const gridSize=32,depthGrid=Array.from({length:gridSize*gridSize},()=>[]);
    const cell=(value,low,span)=>Math.max(0,Math.min(gridSize-1,Math.floor((value-low)/span*gridSize)));
    for(let i=start;i<indices.length;i+=3){
      const triangle=indices.slice(i,i+3).map(id=>vertices.slice(id*13,id*13+3));
      if(triangle.some(p=>p[2]<0))continue;
      const xs=triangle.map(p=>p[0]),ys=triangle.map(p=>p[1]);
      for(let y=cell(Math.min(...ys),box.top,bh);y<=cell(Math.max(...ys),box.top,bh);y++)for(let x=cell(Math.min(...xs),box.left,bw);x<=cell(Math.max(...xs),box.left,bw);x++)depthGrid[y*gridSize+x].push(triangle);
    }
    function frontDepth(x,y){
      if(x<box.left||x>box.right||y<box.top||y>box.bottom)return 0;
      let depth=0;
      for(const [a,b,c] of depthGrid[cell(y,box.top,bh)*gridSize+cell(x,box.left,bw)]){
        const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-9)continue;
        const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det;
        if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)depth=Math.max(depth,u*a[2]+v*b[2]+(1-u-v)*c[2]);
      }
      return depth;
    }
    const leafRoots=green?artwork.leafRoots.map(([x,y])=>[x*w/198,y*h/218]):[[.55*w,.092*h]];
    // Closed stem surfaces use the painted outline, including both branches.
    // Ear clipping preserves narrow concave strokes without fan triangles
    // reaching outside their mask.
    function stemSurface(outline,depth){
      let poly=outline.slice();if(poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1];},0)<0)poly.reverse();
      const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      const pending=poly.map((_,i)=>i),faces=[];
      while(pending.length>3){let found=false;for(let i=0;i<pending.length;i++){
        const a=pending[(i+pending.length-1)%pending.length],b=pending[i],c=pending[(i+1)%pending.length];if(cross(poly[a],poly[b],poly[c])<=1e-8)continue;
        if(pending.some(k=>k!==a&&k!==b&&k!==c&&cross(poly[a],poly[b],poly[k])>=0&&cross(poly[b],poly[c],poly[k])>=0&&cross(poly[c],poly[a],poly[k])>=0))continue;
        faces.push([a,b,c]);pending.splice(i,1);found=true;break;
      }if(!found)break;}
      if(pending.length===3)faces.push(pending.slice());
      start=begin();const sides=[[],[]],thickness=bw*.018;
      for(let side=0;side<2;side++)for(const [x,y] of poly){const z=depth(x,y)+(side===0?1:-1)*thickness/2;sides[side].push(add([x,y,z],[x/w,y/h],2,[0,0],[x,y]));}
      for(const [a,b,c] of faces){tri(sides[0][a],sides[0][b],sides[0][c]);tri(sides[1][a],sides[1][c],sides[1][b]);}
      for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;tri(sides[0][i],sides[1][i],sides[0][j]);tri(sides[0][j],sides[1][i],sides[1][j]);}
      end('stem',start);
    }
    const leafDepths=[],leafDepthAt=[];
    parts.slice(1).forEach((outline,index)=>{
      let poly=outline.slice();const area=poly.reduce((n,p,i)=>{const q=poly[(i+1)%poly.length];return n+p[0]*q[1]-q[0]*p[1];},0);if(area<0)poly.reverse();
      const leafBox=bounds(poly),root=leafRoots[index],tip=poly.reduce((best,p)=>Math.hypot(p[0]-root[0],p[1]-root[1])>Math.hypot(best[0]-root[0],best[1]-root[1])?p:best,poly[0]);
      const dx=tip[0]-root[0],dy=tip[1]-root[1],length=Math.hypot(dx,dy),width=Math.min(leafBox.right-leafBox.left,leafBox.bottom-leafBox.top),thickness=width*.014;
      const center=[root[0]+dx*.52,root[1]+dy*.52],layers=12,n=poly.length,ids=[[],[]];start=begin();
      const bend=(s,t)=>width*(.26*Math.sin(Math.PI*clamp(s))+.32*t*t+((index%2?-.22:.22)*t)+.20*s);
      // Place the complete blade in front of the fruit's actual surface, not
      // merely its bounding box. The fixed offset also keeps its petiole joined.
      let depth=width*.08;
      for(let ring=0;ring<=layers;ring++)for(const q of poly){
        const r=ring/layers,x=center[0]+(q[0]-center[0])*r,y=center[1]+(q[1]-center[1])*r;
        const s=((x-root[0])*dx+(y-root[1])*dy)/(length*length),t=(-(x-root[0])*dy+(y-root[1])*dx)/(length*width);
        depth=Math.max(depth,frontDepth(x,y)+bw*.025-bend(s,t)+thickness/2);
      }
      for(let side=0;side<2;side++)for(let ring=0;ring<=layers;ring++){
        ids[side][ring]=[];const count=ring===0?1:n;
        for(let i=0;i<count;i++){
          const r=ring/layers,q=poly[i],x=center[0]+(q[0]-center[0])*r,y=center[1]+(q[1]-center[1])*r;
          const s=((x-root[0])*dx+(y-root[1])*dy)/(length*length),t=(-(x-root[0])*dy+(y-root[1])*dx)/(length*width);
          const z=depth+bend(s,t)+(side===0?1:-1)*thickness/2;
          ids[side][ring].push(add([x,y,z],[x/w,y/h],1,[s,t],[x,y]));
        }
      }
      for(let side=0;side<2;side++){
        const face=(a,b,c)=>side===0?tri(a,b,c):tri(a,c,b);
        for(let i=0;i<n;i++)face(ids[side][0][0],ids[side][1][i],ids[side][1][(i+1)%n]);
        for(let j=1;j<layers;j++)for(let i=0;i<n;i++){const k=(i+1)%n,a=ids[side][j][i],b=ids[side][j][k],c=ids[side][j+1][i],d=ids[side][j+1][k];face(a,c,b);face(b,c,d);}
      }
      for(let i=0;i<n;i++){const k=(i+1)%n,a=ids[0][layers][i],b=ids[0][layers][k],c=ids[1][layers][i],d=ids[1][layers][k];tri(a,b,c);tri(b,d,c);}
      end('leaf',start);Object.assign(groups.at(-1),{leaf:index,root,root3:[...root,depth],path:artwork.paths[index+1]});
      leafDepths.push(depth);leafDepthAt.push((x,y)=>depth+bend(((x-root[0])*dx+(y-root[1])*dy)/(length*length),(-(x-root[0])*dy+(y-root[1])*dx)/(length*width)));
    });
    if(green){
      const upper=Math.max(leafDepths[0],leafDepths[1]),central=leafDepths[4];
      const trunkDepth=(x,y)=>{const sourceY=y/h*218,lower=smooth((sourceY-70)/34);return (upper+(central-upper)*smooth((sourceY-36)/23))*(1-lower)+(frontDepth(x,y)+bw*.02)*lower;};
      artwork.greenStems.forEach((poly,index)=>{stemSurface(poly.map(([x,y])=>[x*w/198,y*h/218]),index===0?trunkDepth:(x,y)=>{
        const join=index===1?[96,34]:[98,35],end=index===1?[76,58]:[109,55],dx=end[0]-join[0],dy=end[1]-join[1];
        const t=clamp(((x/w*198-join[0])*dx+(y/h*218-join[1])*dy)/(dx*dx+dy*dy));
        return trunkDepth(join[0]*w/198,join[1]*h/218)*(1-t)+leafDepthAt[index+1](x,y)*t;
      });Object.assign(groups.at(-1),{branch:index,leaf:index?index+1:null,root:index?leafRoots[index+1]:null});});
      const join=[95*w/198,37*h/218],tip=leafRoots[1];
      stemSurface(artwork.samplePath(artwork.petiolePath).map(([x,y])=>[(x-530)*w/198,(y-312)*h/218]),(x,y)=>{
        const t=clamp((x-join[0])/(tip[0]-join[0]));return trunkDepth(...join)*(1-t)+leafDepthAt[1](...tip)*t;
      });groups.at(-1).kind='petiole';
    }else{
      // Follow the photograph's actual alpha at each row above the fruit;
      // inside the fruit retain the narrow visible brown stalk's centre line.
      const left=[],right=[];
      for(let y=Math.floor(h*.048);y<=Math.floor(h*.246);y+=Math.max(1,Math.floor(h/512))){
        const center=w*(.554-.20*y/h),radius=w*.022;let lo=w,hi=-1;
        for(let x=Math.floor(center-radius);x<=Math.ceil(center+radius);x++)if(pixels[(y*w+x)*4+3]>150){lo=Math.min(lo,x);hi=Math.max(hi,x+1);}
        if(hi>lo){left.push([lo,y]);right.push([hi,y]);}
      }
      if(left.length>2)stemSurface([...right,...left.reverse()],(x,y)=>frontDepth(x,y)+bw*.03);
    }
    // Each shedding twig shares its blade's actual 3D pivot and envelope.
    for(const group of groups){
      if(group.leaf!==undefined&&group.leaf!==null){const blade=groups.find(g=>g.kind==='leaf'&&g.leaf===group.leaf);group.root3=blade.root3;}
      if(green&&group.kind==='stem')group.path=artwork.paths[6].match(/M[^M]+/g)[group.branch];
      if(group.kind==='petiole')group.path=artwork.petiolePath;
      if(group.kind==='body')group.path=artwork.paths[0];
      if(group.root3){let radius=0;for(let i=group.offset;i<group.offset+group.count;i++){const k=indices[i]*13;radius=Math.max(radius,Math.hypot(vertices[k]-group.root3[0],vertices[k+1]-group.root3[1],vertices[k+2]-group.root3[2]));}group.radius=radius;}
    }
    // Area-weighted normals include both blade surfaces and the joined walls.
    for(let i=0;i<indices.length;i+=3){const a=indices[i]*13,b=indices[i+1]*13,c=indices[i+2]*13,ux=vertices[b]-vertices[a],uy=vertices[b+1]-vertices[a+1],uz=vertices[b+2]-vertices[a+2],vx=vertices[c]-vertices[a],vy=vertices[c+1]-vertices[a+1],vz=vertices[c+2]-vertices[a+2],n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];for(const k of [a,b,c])for(let d=0;d<3;d++)vertices[k+5+d]+=n[d];}
    for(let i=0;i<vertices.length;i+=13){const length=Math.hypot(...vertices.slice(i+5,i+8))||1;for(let d=5;d<8;d++)vertices[i+d]/=length;}
    return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices),groups,width:w,height:h,pivot:green?[85*w/198,156*h/218]:[cx,cy],bodyBox:box,frontDepth};
  }
  function periodicSkin(pixels,w,h,mode,size=512){
    const data=new Uint8Array(size*size*4),at=(u,v,c)=>{const x=Math.min(w-1,Math.floor(w*(mode==='green'?u:mode==='painted'?.23+.39*u:.22+.54*u))),y=Math.min(h-1,Math.floor(h*(mode==='green'?v:mode==='painted'?.56+.26*v:.32+.45*v)));return pixels[(y*w+x)*4+c];};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/(size-1),v=y/(size-1),a=Math.sin(Math.PI*u)**2,b=Math.sin(Math.PI*v)**2,k=(y*size+x)*4;
      for(let c=0;c<3;c++)data[k+c]=Math.round((at(u,v,c)*a+at((u+.5)%1,v,c)*(1-a))*b+(at(u,(v+.5)%1,c)*a+at((u+.5)%1,(v+.5)%1,c)*(1-a))*(1-b));data[k+3]=255;
    }return {data,size};
  }
  function partPose(group,{detail=1,leaves='all'}={}){
    const extra=group.leaf!==undefined&&group.leaf!==null&&group.leaf!==1;
    return {opacity:leaves==='single'&&extra?0:1,detail,offset:[0,0,0],turn:0};
  }
  const releaseTimes={0:.18,2:.235,3:.29,4:.345};
  const apply=(m,p)=>[0,1,2].map(i=>m[i]*p[0]+m[i+3]*p[1]+m[i+6]*p[2]);
  const multiply=(a,b)=>[...apply(a,b.slice(0,3)),...apply(a,b.slice(3,6)),...apply(a,b.slice(6,9))];
  function rotation(angle,roll=0,tilt=0){
    const c=Math.cos(angle),s=Math.sin(angle),cr=Math.cos(roll),sr=Math.sin(roll),ct=Math.cos(tilt),st=Math.sin(tilt);
    return multiply([c,0,-s,0,1,0,s,0,c],multiply([cr,sr,0,-sr,cr,0,0,0,1],[1,0,0,0,ct,st,0,-st,ct]));
  }
  function transformPoint(transform,p){return apply(transform.matrix,p).map((n,i)=>n+transform.offset[i]);}
  function frameAt(mesh,layout,p){
    const fruit=layout.fruitAt(p),b=Math.min(66/mesh.width,74/mesh.height),scale=b*fruit.size;
    return {scale,origin:[fruit.x+fruit.size*(66-b*mesh.width)/2,fruit.top+fruit.size*(74-b*mesh.height)/2,0]};
  }
  function attachedTransform(mesh,layout,p,angle){
    const frame=frameAt(mesh,layout,p),matrix=rotation(angle).map(n=>n*frame.scale),pivot=[...mesh.pivot,0],rotated=apply(matrix,pivot);
    return {matrix,offset:frame.origin.map((n,i)=>n+frame.scale*pivot[i]-rotated[i]),scale:frame.scale,angle,roll:0,tilt:0,detached:false};
  }
  // Progress is the only clock. Release snapshots are solved analytically even
  // when a scroll jumps over release; later fruit transforms never enter them.
  function flightScene(mesh,layout,progress,{spin=true,angleAt=p=>p*Math.PI*2}={}){
    const p=clamp(progress),angle=p=>spin?angleAt(p):0,attached=attachedTransform(mesh,layout,p,angle(p)),snapshots=new Map(),epsilon=1e-5;
    let gravity=layout.viewport.height*8;
    for(const group of mesh.groups){
      const r=releaseTimes[group.leaf];if(r===undefined||snapshots.has(group.leaf))continue;
      const root=group.root3,at=q=>{const t=attachedTransform(mesh,layout,q,angle(q));return {position:transformPoint(t,root),scale:t.scale,angle:t.angle};};
      const current=at(r),before=at(r-epsilon),after=at(r+epsilon),velocity=current.position.map((_,i)=>(after.position[i]-before.position[i])/(2*epsilon));
      const radius=Math.max(...mesh.groups.filter(g=>g.leaf===group.leaf).map(g=>g.radius||0))*current.scale;
      const tau=.96-r,I=-Math.expm1(-3*tau)/3,J=(tau-I)/3;
      gravity=Math.max(gravity,(layout.viewport.height+radius*2+24-current.position[1]-velocity[1]*I)/J);
      snapshots.set(group.leaf,{...current,root,velocity,radius,release:r,scaleRate:(after.scale-before.scale)/(2*epsilon),angleRate:(after.angle-before.angle)/(2*epsilon)});
    }
    const parts=mesh.groups.map(group=>{
      const snapshot=snapshots.get(group.leaf);if(!snapshot||p<=snapshot.release)return {...attached,root:group.root3?transformPoint(attached,group.root3):null};
      const tau=p-snapshot.release,I=-Math.expm1(-3*tau)/3,J=(tau-I)/3,sign=group.leaf===0||group.leaf===2?-1:1;
      const flutter=1-Math.exp(-tau*tau*12),roll=sign*flutter*.65*Math.sin(tau*11+group.leaf*.4),tilt=flutter*.85*Math.sin(tau*15);
      const position=snapshot.position.map((n,i)=>n+snapshot.velocity[i]*I+(i===1?gravity*J:0));
      position[0]+=sign*snapshot.radius*.35*flutter*Math.sin(tau*8);
      const scale=snapshot.scale+snapshot.scaleRate*I,theta=snapshot.angle+snapshot.angleRate*I,matrix=rotation(theta,roll,tilt).map(n=>n*scale),rotated=apply(matrix,snapshot.root);
      return {matrix,offset:position.map((n,i)=>n-rotated[i]),scale,angle:theta,roll,tilt,root:position,detached:true,release:snapshot.release};
    });
    return {parts,viewport:layout.viewport,gravity};
  }
  const api={buildGeometry,periodicSkin,stage,partPose,rotation,transformPoint,frameAt,attachedTransform,flightScene,releaseTimes};if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root?.document)return;
  function pixels(image){const c=document.createElement('canvas');c.width=image.naturalWidth||image.width;c.height=image.naturalHeight||image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);return {data:ctx.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height};}
  const preparedBases=new Map(),preparedTextures=new WeakMap();
  function materialPixels(image){
    if(preparedTextures.has(image))return preparedTextures.get(image);
    const source=pixels(image),data=new Uint8Array(source.data),{width,height}=source;
    // Carry interior RGB through the transparent border before bilinear sampling.
    // Alpha stays untouched, so front clipping still uses the original mask.
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const k=(y*width+x)*4;if(data[k+3])continue;
      let count=0,r=0,g=0,b=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height)continue;const j=(yy*width+xx)*4;
        if(source.data[j+3]){r+=source.data[j];g+=source.data[j+1];b+=source.data[j+2];count++;}
      }
      if(count){data[k]=r/count;data[k+1]=g/count;data[k+2]=b/count;}
    }
    const result={data,width,height};preparedTextures.set(image,result);return result;
  }
  function prepare(variant){
    if(variant.model&&variant.model.detail===variant.detail)return variant.model;
    const w=variant.base.naturalWidth||variant.base.width,h=variant.base.naturalHeight||variant.base.height;
    const key=variant.baseId?`${variant.colour}:${variant.baseId}:${w}x${h}`:variant.base;
    let base=preparedBases.get(key);
    if(!base){const source=materialPixels(variant.base);base={source,geometry:buildGeometry(variant,source.data),skin:periodicSkin(source.data,w,h,variant.colour==='green'?'painted':'red')};preparedBases.set(key,base);}
    let skin=base.skin;
    if(variant.skin){const surface=materialPixels(variant.skin);skin=surface.periodic||(surface.periodic=periodicSkin(surface.data,surface.width,surface.height,'green'));}
    return variant.model={geometry:base.geometry,base:base.source,detailPixels:variant.detail?materialPixels(variant.detail):base.source,skin,detail:variant.detail};
  }
  function renderer(canvas,{preserveDrawingBuffer=true,antialias=true}={}){
    const gl=canvas.getContext('webgl',{alpha:true,antialias,premultipliedAlpha:true,preserveDrawingBuffer,powerPreference:'low-power'});if(!gl)throw Error('WebGL unavailable');
    const vertex=`
attribute vec3 a_position;attribute vec2 a_uv;attribute vec3 a_normal;attribute vec2 a_local;attribute float a_kind;attribute vec2 a_flat;
uniform mediump float u_shape;uniform vec2 u_center;uniform vec4 u_view;uniform mat3 u_transform;uniform vec3 u_translation;
varying mediump vec2 v_uv;varying mediump vec2 v_local;varying mediump vec2 v_surface;varying mediump vec3 v_normal;varying mediump vec3 v_object;varying mediump float v_kind;
void main(){
 vec3 p=vec3(a_flat,a_position.z*u_shape);
 p=u_transform*p+u_translation;
 float depthScale=max(u_shape,.01);
 float orderedDepth=(p.z+(u_transform*vec3(0.,0.,a_position.z*(depthScale-u_shape))).z)/depthScale;
 gl_Position=vec4(p.xy*u_view.xy+u_view.zw,clamp(-orderedDepth/2400.,-.95,.95),1.);v_uv=a_uv;v_local=a_local;v_surface=vec2(a_position.x-u_center.x,a_position.z);
 v_normal=u_transform*a_normal;v_object=a_normal;v_kind=a_kind;
}`;
    const fragment=`precision mediump float;
uniform sampler2D u_base;uniform sampler2D u_detail;uniform sampler2D u_skin;uniform mediump float u_shape;uniform float u_detailAmount;uniform float u_reveal;uniform float u_green;uniform float u_opacity;uniform float u_connector;
varying mediump vec2 v_uv;varying mediump vec2 v_local;varying mediump vec2 v_surface;varying mediump vec3 v_normal;varying mediump vec3 v_object;varying mediump float v_kind;
void main(){
 vec4 base=texture2D(u_base,v_uv),detail=texture2D(u_detail,v_uv);
 // The retained hero/handle connector bridges a gap in the original painting.
 // Keep its bark opaque while optional photographs are loading or unavailable.
 if(u_connector>.5&&base.a<.5)base=vec4(101./255.,87./255.,38./255.,1.);
 float coverage=mix(base.a,detail.a,u_detailAmount);
 // Concave blades retain their original alpha outline at every angle; radial
 // interior rings may cross the empty notch beside a root.
 if(u_green>.5&&v_kind>.5&&v_kind<1.5&&coverage<.5)discard;
 if(u_reveal<.001&&(u_green<.5||u_detailAmount<.001)&&coverage<.5)discard;
 vec3 front=base.rgb;if(base.a<.5)front=v_kind>1.5?vec3(.30,.24,.12):v_kind>.5?vec3(.24,.31,.10):texture2D(u_skin,v_uv*2.).rgb;
 vec3 n=normalize(v_normal),objectNormal=normalize(v_object),light=normalize(vec3(-.55,-.45,1.));
 float diffuse=.57+.43*max(0.,dot(n,light)),reference=.57+.43*max(0.,dot(objectNormal,light));
 float spec=pow(max(0.,dot(n,normalize(light+vec3(0.,0.,1.)))),24.);
 vec3 painted=front,photographic=detail.a>.5?detail.rgb:front;
 if(v_kind<.5){
  vec2 uv=vec2(atan(v_surface.y,v_surface.x)/6.2831853*2.,v_local.y*1.5);vec3 skin=texture2D(u_skin,uv).rgb;
  float pole=smoothstep(0.,.08,v_local.y)*smoothstep(0.,.08,1.-v_local.y);skin=mix(texture2D(u_skin,vec2(.5,uv.y)).rgb,skin,pole);
  float facing=smoothstep(-.12,.28,objectNormal.z);
  painted=mix(front,mix(skin,front,facing*.75)*diffuse+spec*.05,u_reveal);
  // Both hemispheres share the registered photograph all the way to the rim.
  // Its RGB is dilated beyond the mask before upload: alpha must not switch
  // the rim to painted pixels or a brighter skin swatch when viewed side-on.
  vec3 sourceNormal=vec3(objectNormal.xy,abs(objectNormal.z));
  float sourceDiffuse=.57+.43*max(0.,dot(sourceNormal,light));
  vec3 halfVector=normalize(light+vec3(0.,0.,1.));
  float sourceHalf=max(0.,dot(sourceNormal,halfVector));
  vec3 referenceAppearance=detail.rgb;
  // Remove the reference's broad reflection before applying the same light
  // response in world space. At angle zero the correction is exactly zero.
  float lightRatio=diffuse/sourceDiffuse;
  float reflection=.19*pow(max(0.,dot(n,halfVector)),8.);
  float sourceReflection=.19*pow(sourceHalf,8.);
  photographic=referenceAppearance*lightRatio+(reflection-sourceReflection*lightRatio);
 }else if(v_kind<1.5){
  painted=mix(front,front*diffuse+spec*.035,u_reveal);
  photographic*=diffuse/reference;
 }else{
  painted=mix(front,front*diffuse,u_reveal);photographic*=diffuse/reference;
 }
 vec3 color=mix(painted,photographic,u_detailAmount);
 if(u_green<.5){
  // Preserve the hidden legacy red renderer's material and light response.
  vec3 legacy=mix(base.rgb,detail.rgb,u_detailAmount);if(coverage<.5)legacy=v_kind>1.5?vec3(.30,.24,.12):v_kind>.5?vec3(.24,.31,.10):texture2D(u_skin,v_uv*2.).rgb;
  float d=.58+.42*max(0.,dot(n,light)),s=pow(max(0.,dot(n,normalize(light+vec3(0.,0.,1.)))),32.);color=legacy;
  if(v_kind<.5){
   vec2 uv=vec2(atan(v_surface.y,v_surface.x)/6.2831853*3.,v_local.y*2.);vec3 skin=texture2D(u_skin,uv).rgb;
   float pole=smoothstep(0.,.08,v_local.y)*smoothstep(0.,.08,1.-v_local.y);skin=mix(texture2D(u_skin,vec2(.5,uv.y)).rgb,skin,pole);
   float projected=smoothstep(.25,.92,v_object.z)*smoothstep(.22,.34,v_local.y)*smoothstep(.8,1.,base.a);
   color=mix(legacy,mix(skin,legacy,projected*.65),u_reveal);d+=(texture2D(u_skin,uv+vec2(.0015,0.)).g-texture2D(u_skin,uv-vec2(.0015,0.)).g)*.12;s*=.11;
  }else if(v_kind<1.5){
   vec3 leaf=mix(vec3(.24,.31,.10),legacy,smoothstep(.1,.95,coverage));float midrib=exp(-abs(v_local.y)*100.),veins=pow(max(0.,cos((v_local.x*9.+abs(v_local.y)*2.5)*6.283)),18.)*exp(-abs(v_local.y)*2.);
   leaf+=vec3(.035,.047,.012)*(midrib+veins);color=mix(legacy,leaf,u_reveal);d*=mix(.76,1.,smoothstep(-.4,.4,v_object.z));s*=.07;
  }else{color=mix(legacy,vec3(.30,.24,.12),u_reveal*.22);s*=.035;}
  color=color*mix(1.,d,u_reveal)+s*u_reveal;
 }
 gl_FragColor=vec4(color,u_opacity);
}`;
    function shader(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const uniform=Object.fromEntries(['shape','center','view','detailAmount','reveal','green','base','detail','skin','transform','translation','opacity','connector'].map(k=>[k,gl.getUniformLocation(program,'u_'+k)])),resources=new Map();
    function upload(variant){
      const model=prepare(variant),old=resources.get(variant);if(old?.model===model)return old;
      if(old){gl.deleteBuffer(old.vertices);gl.deleteBuffer(old.indices);old.textures.forEach(t=>gl.deleteTexture(t));}
      const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,model.geometry.vertices,gl.STATIC_DRAW);
      const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,model.geometry.indices,gl.STATIC_DRAW);
      const textures=[model.base,model.detailPixels,model.skin].map((source,i)=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,source.size||source.width,source.size||source.height,0,gl.RGBA,gl.UNSIGNED_BYTE,source.data);for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,axis,i===2?gl.REPEAT:gl.CLAMP_TO_EDGE);for(const filter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,filter,gl.LINEAR);return t;});
      const resource={model,vertices,indices,textures};resources.set(variant,resource);return resource;
    }
    function draw(variant,{shape=1,detail=1,angle=0,geometry=null,leaves='all',flight=null,padding=0}={}){
      const resource=resources.get(variant);if(!resource)return false;const m=resource.model.geometry;
      gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,resource.vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,resource.indices);
      for(const [name,size,offset] of [['position',3,0],['uv',2,12],['normal',3,20],['local',2,32],['kind',1,40],['flat',2,44]]){const loc=gl.getAttribLocation(program,'a_'+name);if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,52,offset);}}
      resource.textures.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(uniform[['base','detail','skin'][i]],i);});
      const span=1+padding*2;let view=[2/m.width/span,-2/m.height/span,-1/span,1/span];if(geometry){const scale=geometry.width/geometry.source.width;view=[scale/360,-scale/360,(geometry.x-geometry.source.x*scale)/360-1,1-(geometry.y-geometry.source.y*scale)/360];}
      if(flight)view=[2/flight.viewport.width,-2/flight.viewport.height,-1,1];
      gl.uniform4fv(uniform.view,view);gl.uniform2fv(uniform.center,[(m.bodyBox.left+m.bodyBox.right)/2,(m.bodyBox.top+m.bodyBox.bottom)/2]);gl.uniform1f(uniform.shape,shape);gl.uniform1f(uniform.reveal,shape*smooth(Math.abs(Math.sin(angle/2))/.16));gl.uniform1f(uniform.detailAmount,detail);gl.uniform1f(uniform.green,variant.colour==='green'?1:0);
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      for(const [index,group] of m.groups.entries()){
        const part=variant.colour==='green'?partPose(group,{detail,leaves}):{detail,opacity:1,offset:[0,0,0],turn:0};
        if(part.opacity<.001)continue;
        gl.uniform1f(uniform.connector,variant.colour==='green'&&group.kind==='petiole'&&(flight||leaves==='single')?1:0);
        gl.uniform1f(uniform.detailAmount,part.detail);gl.uniform1f(uniform.opacity,part.opacity);const matrix=rotation(angle),pivot=[...m.pivot,0],rotated=apply(matrix,pivot),transform=flight?.parts[index]||{matrix,offset:pivot.map((n,i)=>n-rotated[i])};
        gl.uniformMatrix3fv(uniform.transform,false,transform.matrix);gl.uniform3fv(uniform.translation,transform.offset);
        gl.drawElements(gl.TRIANGLES,group.count,gl.UNSIGNED_SHORT,group.offset*2);
      }return true;
    }
    return {upload,draw};
  }
  let endpointRenderer,endpointCanvas;
  function endpoint(variant,leaves='all'){
    const cached=variant.endpoints?.[leaves];if(cached?.detail===variant.detail)return cached.image;
    if(!variant.detail)return variant.base;
    try{
      if(!endpointRenderer){endpointCanvas=document.createElement('canvas');endpointCanvas.width=594;endpointCanvas.height=654;endpointRenderer=renderer(endpointCanvas);}
      endpointRenderer.upload(variant);endpointRenderer.draw(variant,{shape:1,detail:1,angle:0,leaves});
      const copy=document.createElement('canvas');copy.width=594;copy.height=654;copy.getContext('2d').drawImage(endpointCanvas,0,0);variant.endpoints??={};variant.endpoints[leaves]={detail:variant.detail,image:copy};
    }catch{const copy=document.createElement('canvas');copy.width=594;copy.height=654;artwork.drawFrame(copy.getContext('2d'),variant,1,variant.detail,leaves);variant.endpoints??={};variant.endpoints[leaves]={detail:variant.detail,image:copy};}
    if(leaves==='all')variant.endpoint=variant.endpoints[leaves].image;return variant.endpoints[leaves].image;
  }
  root.AppleModel={...api,prepare,renderer,endpoint};
})(typeof window==='object'?window:null);
