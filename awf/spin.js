(function(root){
  'use strict';
  const clamp=n=>Math.min(1,Math.max(0,n));
  const spinAmount=value=>{const t=clamp((value-900)/40);return t*t*(3-2*t);};
  const shouldAnimate=s=>s.ready&&s.value>900&&s.visible&&!s.hidden&&!s.results&&!s.reduced;
  // Joined alpha-silhouette rings give the fruit continuous volume. The source
  // image is projected onto both sides; plant depth blends smoothly into fruit.
  function createMesh(pixels,width,height,geometry,steps=96){
    const rows=[];let first=height,last=0;
    for(let y=0;y<height;y++){
      let left=width,right=-1;
      for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>90){left=Math.min(left,x);right=x;}
      rows.push({left,right});if(right>=left){first=Math.min(first,y);last=y;}
    }
    const vertices=[],indices=[],scale=geometry.width/geometry.source.width;
    const center=geometry.source.x+geometry.source.width/2;
    for(let y=0;y<=steps;y++){
      const sy=first+(last-first)*y/steps,row=rows[Math.round(sy)];
      const radius=Math.max(.1,(row.right-row.left)/2),cx=(row.left+row.right)/2;
      const t=clamp((sy/height-.12)/.25),plantBlend=t*t*(3-2*t);
      const depthRatio=.035+.745*plantBlend;
      for(let x=0;x<=steps;x++){
        const theta=x/steps*Math.PI*2,c=Math.cos(theta),s=Math.sin(theta);
        const sx=cx+radius*c,depth=radius*depthRatio*s;
        const px=(sx-center)*scale,py=geometry.y+(sy-geometry.source.y)*scale;
        vertices.push(px,py,depth*scale,sx/width,sy/height,c,0,s);
      }
    }
    const stride=steps+1;
    for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){
      const a=y*stride+x,b=a+1,c=a+stride,d=c+1;
      indices.push(a,b,c,b,d,c);
    }
    return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices)};
  }
  if(typeof module==='object'&&module.exports)module.exports={createMesh,spinAmount,shouldAnimate};
  if(!root?.document)return;
  const canvas=document.getElementById('apple-spin'),photo=document.getElementById('apple'),api=root.appleExperience;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let gl,program,angleUniform,lightUniform,indexCount,ready=false,visible=false,frame=0,last=null,angle=0,lastDraw=-Infinity;
  const state=()=>({ready,value:api.value,visible,hidden:document.hidden,results:api.resultsVisible,reduced:reduced.matches});
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=null;}
  function draw(){
    if(!ready)return;
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(angleUniform,reduced.matches ? .35 : angle);
    gl.uniform1f(lightUniform,reduced.matches ? .25 : Math.min(1,(1-Math.cos(angle))*2));
    gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);

  }
  function tick(now){
    frame=0;
    if(!shouldAnimate(state())){last=null;return;}
    if(last!==null)angle=(angle+Math.min(100,now-last)*Math.PI*2/24000)%(Math.PI*2);
    last=now;
    if(now-lastDraw>=1000/30){draw();lastDraw=now;}
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    const active=ready&&api.value>900&&!api.resultsVisible;
    canvas.hidden=!active;
    const amount=active?spinAmount(api.value):0;
    canvas.style.opacity=String(amount);photo.style.opacity=String(1-amount);
    if(api.value<=900){angle=0;lastDraw=-Infinity;}
    if(shouldAnimate(state())){if(!frame)frame=requestAnimationFrame(tick);}
    else{stop();if(active&&visible&&!document.hidden)draw();}
  }
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader unavailable');return s;}
  function initialize(image){
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
    if(!gl)return;
    const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
    const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,source.width,source.height).data;
    let x0=source.width,y0=source.height,x1=0,y1=0;
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>90){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    const width=x1-x0+1,height=y1-y0+1,scale=Math.min(590/width,620/height);
    const geometry={width:width*scale,y:(720-height*scale)/2+8,source:{x:x0,y:y0,width,height}};
    const mesh=createMesh(pixels,source.width,source.height,geometry);
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 a_position;attribute vec2 a_uv;attribute vec3 a_normal;uniform float u_angle;varying vec2 v_uv;varying vec3 v_normal;void main(){float c=cos(u_angle),s=sin(u_angle);mat3 r=mat3(c,0.,-s,0.,1.,0.,s,0.,c);vec3 p=r*vec3(a_position.x,0.,a_position.z);gl_Position=vec4(p.x/360.,1.-a_position.y/360.,-p.z/900.,1.);v_uv=a_uv;v_normal=r*a_normal;}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D u_texture;uniform float u_light;varying vec2 v_uv;varying vec3 v_normal;void main(){vec4 color=texture2D(u_texture,v_uv);if(color.a<.1)discard;float light=.84+.16*max(0.,dot(normalize(v_normal),normalize(vec3(-.45,.25,1.))));gl_FragColor=vec4(color.rgb*mix(1.,light,u_light),color.a);}`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program unavailable');gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
    for(const [name,size,offset] of [['a_position',3,0],['a_uv',2,12],['a_normal',3,20]]){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset);}
    const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);indexCount=mesh.indices.length;
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    angleUniform=gl.getUniformLocation(program,'u_angle');lightUniform=gl.getUniformLocation(program,'u_light');
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);gl.viewport(0,0,720,720);
    ready=true;canvas.dataset.renderer='volume';draw();sync();
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;stop();sync();});
  const image=new Image();image.onload=()=>{try{initialize(image);}catch{ready=false;sync();}};image.src='assets/apple.png';
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0}).observe(document.querySelector('.apple-stage'));
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  api.onSelection(sync);api.subscribe(sync);
})(typeof window==='object'?window:null);
