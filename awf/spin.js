(function(root){
  'use strict';
  const clamp=n=>Math.min(1,Math.max(0,n));
  const spinAmount=value=>{const t=clamp((value-900)/40);return t*t*(3-2*t);};
  const shouldAnimate=s=>s.ready&&s.value>=940&&s.visible&&!s.hidden&&!s.results&&!s.reduced;
  const transitionLayers=t=>({body:Math.min(1,clamp(t)*2),photo:Math.min(1,(1-clamp(t))*2)});
  // Looking slightly down reveals the shoulders without moving the fruit pivot.
  function cameraTransform(pivot){
    const pitch=11*Math.PI/180,c=Math.cos(pitch),s=Math.sin(pitch);
    return new Float32Array([1,0,0,0,0,c,-s,0,0,s,c,0,0,pivot*(1-c),pivot*s,1]);
  }
  // The fruit is a closed surface of revolution, independent of the plant.
  // A shallow top depression and broad shoulders replace the former thin,
  // alpha-silhouette extrusion. The seam duplicates identical positions/normals.
  function createMesh(pixels,width,height,geometry,steps=96){
    const vertices=[],indices=[],scale=geometry.width/geometry.source.width;
    const center=geometry.source.x+geometry.source.width/2;
    const point=(p,t)=>{
      const r=Math.pow(Math.max(0,Math.sin(p)),.75);
      const radius=width*.421*r*(1+.009*Math.cos(5*t)*Math.sin(p));
      return [width*.49+radius*Math.cos(t),height*(.128+.792*(1-Math.cos(p))/2+.115*Math.exp(-Math.pow(r/.4,2))*(1+Math.cos(p))/2),radius*.94*Math.sin(t)];
    };
    for(let y=0;y<=steps;y++)for(let x=0;x<=steps;x++){
      const p=y/steps*Math.PI,t=(x===steps?0:x/steps*Math.PI*2),q=point(p,t);
      const a=point(Math.max(.00001,p-.0001),t),b=point(Math.min(Math.PI-.00001,p+.0001),t);
      const dr=Math.hypot(b[0]-width*.49,b[2]/.94)-Math.hypot(a[0]-width*.49,a[2]/.94),dy=b[1]-a[1];
      let nx=dy*Math.cos(t),ny=-dr,nz=dy*Math.sin(t)/.94,n=Math.hypot(nx,ny,nz)||1;
      if(y===0){nx=0;ny=-1;nz=0;n=1;}else if(y===steps){nx=0;ny=1;nz=0;n=1;}
      vertices.push((q[0]-center)*scale,geometry.y+(q[1]-geometry.source.y)*scale,q[2]*scale,q[0]/width,q[1]/height,nx/n,ny/n,nz/n,x/steps,y/steps);
    }
    const stride=steps+1;
    for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){
      const a=y*stride+x,b=a+1,c=a+stride,d=c+1;indices.push(a,b,c,b,d,c);
    }
    const bodyCount=indices.length;
    // Plant and exact initial photograph are separate planes, not fruit rings.
    for(let plane=0;plane<2;plane++){
      const base=vertices.length/10;
      for(const [u,v] of [[0,0],[1,0],[0,1],[1,1]])vertices.push((u*width-center)*scale,geometry.y+(v*height-geometry.source.y)*scale,0,u,v,0,0,1,u,v);
      indices.push(base,base+1,base+2,base+1,base+3,base+2);
    }
    return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices),bodyCount};
  }
  // A periodic, fully opaque skin map uses only interior fruit pixels. It never
  // samples the source's transparent silhouette or mirrors it into a crease.
  function createSkin(pixels,width,height,size=256){
    const data=new Uint8Array(size*size*4);
    const sample=(u,v,c)=>{
      const sx=width*(.21+.58*u),sy=height*(.29+.49*v),x=Math.floor(sx),y=Math.floor(sy),fx=sx-x,fy=sy-y;
      const at=(px,py)=>pixels[(py*width+px)*4+c];
      return (at(x,y)*(1-fx)+at(x+1,y)*fx)*(1-fy)+(at(x,y+1)*(1-fx)+at(x+1,y+1)*fx)*fy;
    };
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/(size-1),v=y/(size-1),shifted=(u+.5)%1,weight=Math.sin(Math.PI*u)**2;
      // Each strip's wrap falls where its weight and first derivative are zero.
      // The other strip supplies real texture there, rather than a flat column.
      for(let c=0;c<3;c++)data[(y*size+x)*4+c]=Math.round(sample(u,v,c)*weight+sample(shifted,v,c)*(1-weight));
      data[(y*size+x)*4+3]=255;
    }
    return {data,size};
  }
  if(typeof module==='object'&&module.exports)module.exports={createMesh,createSkin,spinAmount,shouldAnimate,transitionLayers,cameraTransform};
  if(!root?.document)return;
  const canvas=document.getElementById('apple-spin'),photo=document.getElementById('apple'),api=root.appleExperience;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let gl,program,uniforms,mesh,ready=false,visible=false,frame=0,last=null,elapsed=0,lastDraw=-Infinity;
  const state=()=>({ready,value:api.value,visible,hidden:document.hidden,results:api.resultsVisible,reduced:reduced.matches});
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=null;}
  function draw(){
    if(!ready)return;
    const t=reduced.matches?0:clamp(elapsed/1400),layers=transitionLayers(t);
    const angle=(elapsed-600*(1-Math.exp(-elapsed/600)))*Math.PI*2/24000;
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.angle,angle);
    gl.enable(gl.DEPTH_TEST);gl.uniform1f(uniforms.alpha,layers.body);
    if(layers.body>0){
      gl.uniform1f(uniforms.mode,0);gl.drawElements(gl.TRIANGLES,mesh.bodyCount,gl.UNSIGNED_SHORT,0);
      gl.uniform1f(uniforms.mode,1);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,mesh.bodyCount*2);
    }
    if(layers.photo>0){
      gl.disable(gl.DEPTH_TEST);gl.uniform1f(uniforms.mode,2);gl.uniform1f(uniforms.alpha,layers.photo);
      gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,(mesh.bodyCount+6)*2);
    }
  }
  function tick(now){
    frame=0;if(!shouldAnimate(state())){last=null;return;}
    if(last!==null)elapsed+=Math.min(100,now-last);last=now;
    if(now-lastDraw>=1000/30){draw();lastDraw=now;}frame=requestAnimationFrame(tick);
  }
  function sync(){
    const active=ready&&api.value>900&&!api.resultsVisible,amount=active?spinAmount(api.value):0;
    if(api.value<940){elapsed=0;lastDraw=-Infinity;}
    // Paint before exposure, including rapid reverse scrubs and restored tabs.
    if(active)draw();
    canvas.hidden=!active;canvas.style.opacity=String(amount);
    // The bottom photograph stays opaque throughout the CSS handoff. At 940
    // the top canvas contains the same fully painted photograph before swapping.
    photo.style.opacity=amount===1?'0':'1';
    if(shouldAnimate(state())){if(!frame)frame=requestAnimationFrame(tick);}else stop();
  }
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader: '+gl.getShaderInfoLog(s));return s;}
  function initialize(image){
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});if(!gl)throw Error('WebGL context unavailable');
    const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
    const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,source.width,source.height).data;
    let x0=source.width,y0=source.height,x1=0,y1=0;
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>90){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    const width=x1-x0+1,height=y1-y0+1,scale=Math.min(590/width,620/height);
    mesh=createMesh(pixels,source.width,source.height,{width:width*scale,y:(720-height*scale)/2+8,source:{x:x0,y:y0,width,height}});
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 a_position;attribute vec2 a_uv;attribute vec3 a_normal;attribute vec2 a_skin;uniform float u_angle;uniform mediump float u_mode;uniform mat4 u_camera;varying vec2 v_uv;varying vec2 v_skin;varying vec3 v_normal;varying float v_front;void main(){float angle=u_mode>1.5?0.:u_angle;float c=cos(angle),s=sin(angle);mat3 r=mat3(c,0.,-s,0.,1.,0.,s,0.,c);vec3 p=r*vec3(a_position.x,0.,a_position.z);vec4 projected=vec4(p.x,a_position.y,p.z,1.);vec3 normal=r*a_normal;if(u_mode<1.5){projected=u_camera*projected;normal=mat3(u_camera)*normal;}gl_Position=vec4(projected.x/360.,1.-projected.y/360.,-projected.z/900.,1.);v_uv=a_uv;v_skin=a_skin;v_normal=normal;v_front=a_normal.z;}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D u_texture;uniform sampler2D u_skin;uniform mediump float u_mode;uniform float u_alpha;varying vec2 v_uv;varying vec2 v_skin;varying vec3 v_normal;varying float v_front;void main(){vec4 original=texture2D(u_texture,v_uv);if(u_mode>.5){if(u_mode<1.5){float y=v_uv.y;float lo=.488+(.246-y)*.11;float hi=.508+(.246-y)*.30;bool stem=y<.247&&v_uv.x>lo&&v_uv.x<hi;bool leaf=y<.163&&v_uv.x>.557&&y<.065+(v_uv.x-.557)*.55;if(!stem&&!leaf)discard;}if(original.a<.01)discard;gl_FragColor=vec4(original.rgb,original.a*u_alpha);return;}vec3 skin=texture2D(u_skin,v_skin).rgb;float front=smoothstep(.35,.9,v_front)*smoothstep(.95,1.,original.a);vec3 color=mix(skin,original.rgb,front*.82);float light=.78+.22*max(0.,dot(normalize(v_normal),normalize(vec3(-.4,-.3,1.))));gl_FragColor=vec4(color*light,u_alpha);}`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program: '+gl.getProgramInfoLog(program));gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
    for(const [name,size,offset] of [['a_position',3,0],['a_uv',2,12],['a_normal',3,20],['a_skin',2,32]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset);}
    const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
    for(let unit=0;unit<2;unit++){
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
      if(unit===0)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      else{const skin=createSkin(pixels,source.width,source.height);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,skin.size,skin.size,0,gl.RGBA,gl.UNSIGNED_BYTE,skin.data);}
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program,unit===0?'u_texture':'u_skin'),unit);
    }
    uniforms=Object.fromEntries(['angle','mode','alpha'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'u_camera'),false,cameraTransform((720-height*scale)/2+8+(source.height*.53-y0)*scale));
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);gl.viewport(0,0,720,720);
    ready=true;canvas.dataset.renderer='rounded-volume';draw();sync();
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;stop();sync();});
  const image=new Image();image.onload=()=>{try{initialize(image);}catch(error){ready=false;canvas.dataset.rendererError=String(error?.message||error);console.error('Apple volume initialization failed:',error);sync();}};image.src='assets/apple.png';
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0}).observe(document.querySelector('.apple-stage'));
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);api.onSelection(sync);api.subscribe(sync);
})(typeof window==='object'?window:null);
