(function(root){
  'use strict';
  const clamp=n=>Math.max(0,Math.min(1,n));
  const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
  function pose(progress){
    const p=clamp(progress),blend=smooth(p/.08)*smooth((1-p)/.08);
    return {angle:p*Math.PI*2,body:Math.min(1,blend*2),photo:Math.min(1,(1-blend)*2),original:p===0||p===1};
  }
  function mesh(steps=48){
    const vertices=[],indices=[];
    for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
      const p=j/steps*Math.PI,t=(i===steps?0:i/steps*Math.PI*2),r=Math.pow(Math.max(0,Math.sin(p)),.8);
      const x=85+60*r*Math.cos(t),y=101+110*(1-Math.cos(p))/2+8*Math.exp(-((r/.4)**2))*(1+Math.cos(p))/2,z=57*r*Math.sin(t);
      vertices.push(x,y,z,x/198,y/218,Math.cos(t)*Math.sin(p),-Math.cos(p),Math.sin(t)*Math.sin(p),i/steps,j/steps);
    }
    for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){const a=j*(steps+1)+i,b=a+1,c=a+steps+1;indices.push(a,b,c,b,c+1,c);}
    const bodyCount=indices.length;
    for(let k=0;k<2;k++){
      const base=vertices.length/10;
      for(const [u,v] of [[0,0],[1,0],[0,1],[1,1]])vertices.push(u*198,v*218,0,u,v,0,0,1,u,v);
      indices.push(base,base+1,base+2,base+1,base+3,base+2);
    }
    return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices),bodyCount};
  }
  function skin(pixels,width,height,size=128){
    const data=new Uint8Array(size*size*4);
    const sample=(u,v,c)=>{
      const x=Math.min(width-1,575+80*u),y=Math.min(height-1,435+62*v),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=x-x0,fy=y-y0;
      const at=(a,b)=>pixels[(b*width+a)*4+c];
      return (at(x0,y0)*(1-fx)+at(x1,y0)*fx)*(1-fy)+(at(x0,y1)*(1-fx)+at(x1,y1)*fx)*fy;
    };
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/(size-1),v=y/(size-1),w=Math.sin(Math.PI*u)**2;
      for(let c=0;c<3;c++)data[(y*size+x)*4+c]=Math.round(sample(u,v,c)*w+sample((u+.5)%1,v,c)*(1-w));
      data[(y*size+x)*4+3]=255;
    }
    return {data,size};
  }
  if(typeof module==='object'&&module.exports)module.exports={pose,mesh,skin};
  if(!root?.document)return;
  const button=document.getElementById('fall-spin-toggle'),apple=document.querySelector('.scroll-apple'),scene=apple?.querySelector('svg');
  if(!button||!scene)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let enabled=false,loading=false,renderer,canvas,progress=0,visible=false,lastDraw=-1;
  try{enabled=localStorage.getItem('awf-helicopter')==='true';}catch{}
  function restore(){if(canvas)canvas.hidden=true;scene.style.visibility='';}
  function sync(){
    button.checked=enabled;
    if(!enabled||reduced.matches||!visible||document.hidden||!renderer||pose(progress).original){restore();return;}
    if(lastDraw!==progress){renderer(progress);lastDraw=progress;}
    canvas.hidden=false;scene.style.visibility='hidden';
  }
  function initialize(image){
    canvas=document.createElement('canvas');canvas.className='fall-spin-canvas';canvas.width=396;canvas.height=444;canvas.hidden=true;canvas.setAttribute('aria-hidden','true');apple.appendChild(canvas);
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
    if(!gl)throw Error('WebGL unavailable');
    const paths=Array.from(scene.querySelectorAll('clipPath path'));
    function cutout(plant){
      const c=document.createElement('canvas');c.width=396;c.height=436;const ctx=c.getContext('2d');ctx.scale(2,2);ctx.translate(-530,-312);
      const clip=new Path2D();for(const path of paths.slice(plant?1:0))clip.addPath(new Path2D(path.getAttribute('d')));
      ctx.clip(clip);ctx.drawImage(image,0,0);return c;
    }
    const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
    const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,source.width,source.height).data;
    const geometry=mesh();
    function shader(type,text){const shader=gl.createShader(type);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 a_position;attribute vec2 a_uv;attribute vec3 a_normal;attribute vec2 a_skin;uniform float u_angle;uniform mediump float u_mode;varying vec2 v_uv;varying vec2 v_skin;varying vec3 v_normal;varying float v_front;void main(){float a=u_mode>1.5?0.:u_angle;float c=cos(a),s=sin(a);mat3 r=mat3(c,0.,-s,0.,1.,0.,s,0.,c);vec3 p=r*vec3(a_position.x-85.,a_position.y-156.,a_position.z);float tilt=u_mode>1.5?0.:.18;float ct=cos(tilt),st=sin(tilt);mat3 camera=mat3(1.,0.,0.,0.,ct,-st,0.,st,ct);p=camera*p;gl_Position=vec4((p.x+85.)/99.-1.,1.-(p.y+158.)/111.,-p.z/400.,1.);v_uv=a_uv;v_skin=a_skin;v_normal=camera*r*a_normal;v_front=a_normal.z;}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D u_photo;uniform sampler2D u_plant;uniform sampler2D u_skin;uniform mediump float u_mode;uniform float u_alpha;varying vec2 v_uv;varying vec2 v_skin;varying vec3 v_normal;varying float v_front;void main(){vec4 photo=texture2D(u_photo,v_uv);if(u_mode>.5){vec4 color=u_mode>1.5?photo:texture2D(u_plant,v_uv);if(color.a<.01)discard;gl_FragColor=vec4(color.rgb,color.a*u_alpha);return;}vec3 color=mix(texture2D(u_skin,v_skin).rgb,photo.rgb,smoothstep(.35,.9,v_front)*smoothstep(.95,1.,photo.a)*.85);float light=.87+.13*max(0.,dot(normalize(v_normal),normalize(vec3(-.4,-.35,1.))));gl_FragColor=vec4(color*light,u_alpha);}`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);
    for(const [name,size,offset] of [['a_position',3,0],['a_uv',2,12],['a_normal',3,20],['a_skin',2,32]]){const attr=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,size,gl.FLOAT,false,40,offset);}
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geometry.indices,gl.STATIC_DRAW);
    const textures=[cutout(false),cutout(true),skin(pixels,source.width,source.height)];
    textures.forEach((texture,unit)=>{
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
      if(unit<2)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texture);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,texture.size,texture.size,0,gl.RGBA,gl.UNSIGNED_BYTE,texture.data);
      for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,key,gl.CLAMP_TO_EDGE);
      for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program,['u_photo','u_plant','u_skin'][unit]),unit);
    });
    const angle=gl.getUniformLocation(program,'u_angle'),mode=gl.getUniformLocation(program,'u_mode'),alpha=gl.getUniformLocation(program,'u_alpha');
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);gl.viewport(0,0,canvas.width,canvas.height);
    renderer=value=>{
      const p=pose(value);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(angle,p.angle);gl.enable(gl.DEPTH_TEST);gl.uniform1f(alpha,p.body);
      if(p.body>0){gl.uniform1f(mode,0);gl.drawElements(gl.TRIANGLES,geometry.bodyCount,gl.UNSIGNED_SHORT,0);gl.uniform1f(mode,1);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,geometry.bodyCount*2);}
      if(p.photo>0){gl.disable(gl.DEPTH_TEST);gl.uniform1f(mode,2);gl.uniform1f(alpha,p.photo);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,(geometry.bodyCount+6)*2);}
    };
    canvas.dataset.renderer='green-volume';canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer=null;enabled=false;button.disabled=true;restore();sync();});
  }
  function load(){
    if(loading||renderer)return;loading=true;button.setAttribute('aria-busy','true');const image=new Image();
    function fail(error){enabled=false;button.disabled=true;button.title='Helicopter unavailable in this browser';button.dataset.rendererError=String(error?.message||error);console.error('Falling apple volume unavailable:',error);button.removeAttribute('aria-busy');restore();sync();}
    image.onload=()=>{try{initialize(image);button.removeAttribute('aria-busy');sync();}catch(error){fail(error);}};image.onerror=()=>fail(Error('Painting image unavailable'));image.src=scene.querySelector('image').getAttribute('href');
  }
  function preference(){button.disabled=reduced.matches;button.title=reduced.matches?'Helicopter is off with reduced motion':'Turn the falling apple';if(enabled&&!reduced.matches)load();sync();}
  button.addEventListener('change',()=>{if(reduced.matches)return;enabled=button.checked;try{localStorage.setItem('awf-helicopter',String(enabled));}catch{}if(enabled)load();sync();});
  reduced.addEventListener('change',preference);document.addEventListener('visibilitychange',sync);
  root.fallingAppleSpin={update(value,onScreen){progress=clamp(value);visible=onScreen;sync();}};
  preference();
})(typeof window==='object'?window:null);
