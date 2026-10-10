(function (root) {
  'use strict';
  const vertexSource = `attribute vec3 aPosition; attribute vec3 aNormal; attribute vec2 aUV;
    uniform mat4 uModel; uniform mat4 uViewProjection;
    varying vec3 vPosition; varying vec3 vNormal; varying vec2 vUV;
    void main(){vec4 p=uModel*vec4(aPosition,1.0);vPosition=p.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUV=aUV;gl_Position=uViewProjection*p;}`;
  const fragmentSource = `precision mediump float; varying vec3 vPosition; varying vec3 vNormal; varying vec2 vUV;
    uniform vec3 uColor; uniform vec3 uEye; uniform vec3 uKeyColor; uniform float uAmbient; uniform float uIntensity; uniform float uGloss; uniform float uEmission; uniform float uOpacity; uniform float uTextureMix;
    uniform sampler2D uTexture; uniform vec3 uPointPos[8]; uniform vec3 uPointColor[8];
    void main(){vec4 tex=texture2D(uTexture,vUV);vec3 albedo=mix(uColor,tex.rgb,uTextureMix);vec3 n=normalize(vNormal);vec3 light=vec3(uAmbient);vec3 key=normalize(vec3(-0.35,0.85,0.55));float lambert=max(dot(n,key),0.0);light+=uKeyColor*lambert*uIntensity*.65;
    vec3 spec=vec3(0.0);vec3 viewDir=normalize(uEye-vPosition);spec+=uKeyColor*pow(max(dot(n,normalize(key+viewDir)),0.0),mix(12.0,100.0,uGloss))*uGloss*.45;
    for(int i=0;i<8;i++){vec3 delta=uPointPos[i]-vPosition;float dist=length(delta);vec3 l=normalize(delta);float atten=1.0/(1.0+dist*dist*4.0);light+=uPointColor[i]*max(dot(n,l),0.0)*atten;spec+=uPointColor[i]*pow(max(dot(n,normalize(l+viewDir)),0.0),40.0)*uGloss*atten*.25;}
    vec3 color=albedo*light+spec+albedo*uEmission; color=pow(max(color,vec3(0.0)),vec3(.80));gl_FragColor=vec4(color,uOpacity*mix(1.0,tex.a,uTextureMix));}`;
  const multiply = (a, b) => { const out = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return out; };
  const normalize = v => { const len = Math.hypot(...v) || 1; return v.map(x => x / len); };
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
  function lookAt(eye, target) { const z = normalize(eye.map((n, i) => n - target[i])), x = normalize(cross([0,1,0],z)), y = cross(z,x); return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]); }
  function perspective(aspect) { const f = 1 / Math.tan(Math.PI / 7); return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,-1.004,-1,0,0,-.1002,0]); }
  function model(center, size, angle = 0) { const c = Math.cos(angle), s = Math.sin(angle); return new Float32Array([c*size[0],0,-s*size[0],0,0,size[1],0,0,s*size[2],0,c*size[2],0,...center,1]); }
  function geometry() {
    const out = [];
    const faces = [
      [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]], [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
      [[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]], [[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],
      [[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]], [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]
    ];
    const uv = [[0,0],[1,0],[1,1],[0,1]];
    for (const [normal, verts] of faces) for (const index of [0,1,2,0,2,3]) out.push(...verts[index],...normal,...uv[index]);
    return new Float32Array(out);
  }
  function cylinderGeometry() {
    const out = [], add = (p,n,uv) => out.push(...p,...n,...uv);
    for(let i=0;i<32;i++){
      const a=i*Math.PI/16,b=(i+1)*Math.PI/16,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
      add([0,.5,0],[0,1,0],[.5,.5]);add([ca*.5,.5,sa*.5],[0,1,0],[(ca+1)/2,(sa+1)/2]);add([cb*.5,.5,sb*.5],[0,1,0],[(cb+1)/2,(sb+1)/2]);
      for(const [c,s,y,u] of [[ca,sa,-.5,0],[cb,sb,-.5,1],[cb,sb,.5,1],[ca,sa,-.5,0],[cb,sb,.5,1],[ca,sa,.5,0]]) add([c*.5,y,s*.5],[c,0,s],[u,y+.5]);
    }
    return new Float32Array(out);
  }
  const rgb = color => { const hex = /^#[a-f\d]{6}$/i.test(color || '') ? color : '#ffffff'; return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255); };
  class KitchenView {
    constructor(canvas, message, select) {
      this.canvas=canvas;this.message=message;this.select=select;this.yaw=.6;this.pitch=.38;this.distance=4.6;this.target=[1.3,1.15,.5];this.pending=false;this.selected=null;this.textures=new Map();this.hits=[];
      try { this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true}); if(this.gl) this.init(); } catch { this.gl=null; }
      if(!this.gl){this.ctx=canvas.getContext('2d');if(!this.ctx){const fresh=canvas.cloneNode();canvas.replaceWith(fresh);this.canvas=canvas=fresh;this.ctx=canvas.getContext('2d');}message.textContent='3D недоступно на этом устройстве. Показан план сверху; расчёт работает.';}
      this.events();this.resizeObserver=new ResizeObserver(()=>this.schedule());this.resizeObserver.observe(canvas);
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();message.textContent='Изображение 3D приостановлено браузером. Обновите страницу; проект сохранён.';});
    }
    init(){
      const gl=this.gl,compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertexSource));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
      this.buffers={};for(const [key,data]of Object.entries({cube:geometry(),cylinder:cylinderGeometry()})){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.buffers[key]={buffer,count:data.length/8};}
      this.attributes=['aPosition','aNormal','aUV'].map(n=>gl.getAttribLocation(this.program,n));this.uniforms={};for(const n of ['uModel','uViewProjection','uColor','uEye','uKeyColor','uAmbient','uIntensity','uGloss','uEmission','uOpacity','uTextureMix','uTexture','uPointPos[0]','uPointColor[0]'])this.uniforms[n]=gl.getUniformLocation(this.program,n);
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.uniform1i(this.uniforms.uTexture,0);this.white=this.textureFrom('#ffffff');this.shadow=this.textureFrom('shadow');
    }
    textureFrom(key, image){
      const gl=this.gl,c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
      if(image){ctx.drawImage(image,0,0,512,512);}else if(key==='shadow'){const gradient=ctx.createRadialGradient(256,256,35,256,256,256);gradient.addColorStop(0,'rgba(18,28,24,.36)');gradient.addColorStop(.65,'rgba(18,28,24,.20)');gradient.addColorStop(1,'rgba(18,28,24,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,512,512);}else{
        if(key.startsWith('tile:')){ctx.fillStyle=key.slice(5);ctx.fillRect(0,0,512,512);ctx.strokeStyle='#c9ccc4';ctx.lineWidth=3;for(let y=0;y<=512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();for(let x=(y/128)%2?128:0;x<=512;x+=256){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+128);ctx.stroke();}}}
        const preset=window.MebelCatalog.presets.find(p=>p.id===key);if(!key.startsWith('tile:')){ctx.fillStyle=preset?.color||key;ctx.fillRect(0,0,512,512);}
        if(['oak','walnut'].includes(key)){let seed=13;for(let i=0;i<180;i++){seed=(seed*16807)%2147483647;const x=seed%512;ctx.strokeStyle=i%3?'rgba(48,28,11,.08)':'rgba(255,245,218,.14)';ctx.lineWidth=1+(seed%5);ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x-12,150,x+12,340,x-4,512);ctx.stroke();}}
      }
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);return texture;
    }
    texture(decor){
      const key=decor.image||decor.id+decor.color+(decor.pattern||'');
      if(this.textures.has(key))return this.textures.get(key);
      const texture=decor.pattern==='tile'&&!decor.image?this.textureFrom('tile:'+decor.color):this.textureFrom(decor.color||'#ffffff');this.textures.set(key,texture);
      if(decor.image){const image=new Image();image.onload=()=>{const loaded=this.textureFrom('',image);this.textures.set(key,loaded);this.gl.deleteTexture(texture);this.schedule();};image.src=decor.image;}else if(['oak','walnut'].includes(decor.id)){this.gl.deleteTexture(texture);const wood=this.textureFrom(decor.id);this.textures.set(key,wood);return wood;}
      return texture;
    }
    events(){
      const pointers=new Map();let start=null, moved=0,lastPinch=0;
      this.canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,[e.clientX,e.clientY]);this.canvas.setPointerCapture(e.pointerId);start=[e.clientX,e.clientY];moved=0;lastPinch=0;});
      this.canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);moved+=Math.abs(e.clientX-old[0])+Math.abs(e.clientY-old[1]);if(pointers.size===2){const p=[...pointers.values()],distance=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(lastPinch)this.distance=Math.max(1.2,Math.min(15,this.distance*lastPinch/distance));lastPinch=distance;}else{this.yaw-=(e.clientX-old[0])*.008;this.pitch=Math.max(.02,Math.min(1.5,this.pitch+(e.clientY-old[1])*.006));}this.schedule();});
      const end=e=>{pointers.delete(e.pointerId);lastPinch=0;if(moved<8&&start){const r=this.canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=this.hits.filter(h=>Math.hypot(h.x-x,h.y-y)<h.radius).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(hit)this.select(hit.id);}start=null;};this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',()=>{pointers.clear();start=null;});
      this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(1.2,Math.min(15,this.distance*Math.exp(e.deltaY*.001)));this.schedule();},{passive:false});
      this.canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')this.yaw+=.1;if(e.key==='ArrowRight')this.yaw-=.1;if(e.key==='ArrowUp')this.pitch=Math.min(1.5,this.pitch+.1);if(e.key==='ArrowDown')this.pitch=Math.max(.02,this.pitch-.1);if(e.key==='+')this.distance=Math.max(1.2,this.distance*.9);if(e.key==='-')this.distance=Math.min(15,this.distance*1.1);this.schedule();}});
    }
    update(result, project){if(this.gl&&this.textures.size>32){for(const t of this.textures.values())this.gl.deleteTexture(t);this.textures.clear();}this.result=result;this.project=project;this.schedule();}
    view(mode){if(mode==='top'){this.pitch=1.48;this.yaw=0;}else if(mode==='front'){this.pitch=.04;this.yaw=0;}else{this.pitch=.38;this.yaw=.6;}this.schedule();}
    fit(){if(!this.result?.modules.length)return;const r=this.result;const maxX=Math.max(...r.modules.map(m=>m.x+(m.run==='A'?m.width:m.depth)))/1000;const maxZ=Math.max(...r.modules.map(m=>m.z+(m.run==='B'?m.width:m.depth)))/1000;this.target=[maxX*.5,1.1,maxZ*.35];this.distance=Math.max(3.4,Math.max(maxX,maxZ)*1.7);this.schedule();}
    schedule(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.render();});}
    render(){
      const bounds=this.canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.round(bounds.width*ratio));this.canvas.height=Math.max(1,Math.round(bounds.height*ratio));
      if(!this.result||this.result.errors.length)return;
      if(!this.gl){this.plan2D(bounds);return;}
      const gl=this.gl,p=this.project,r=this.result,light=p.light||{},night=light.mode==='evening';gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(night?.12:.88,night?.15:.91,night?.18:.91,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const eye=[this.target[0]+Math.sin(this.yaw)*Math.cos(this.pitch)*this.distance,this.target[1]+Math.sin(this.pitch)*this.distance,this.target[2]+Math.cos(this.yaw)*Math.cos(this.pitch)*this.distance];
      this.viewProjection=multiply(perspective(bounds.width/Math.max(1,bounds.height)),lookAt(eye,this.target));gl.uniformMatrix4fv(this.uniforms.uViewProjection,false,this.viewProjection);gl.uniform3fv(this.uniforms.uEye,eye);gl.uniform3fv(this.uniforms.uKeyColor,night?[1,.78,.57]:[1,.98,.94]);gl.uniform1f(this.uniforms.uAmbient,night?.19:light.mode==='studio'?.7:.56);gl.uniform1f(this.uniforms.uIntensity,Number(light.intensity)||1);
      const pointPos=new Float32Array(24),pointColor=new Float32Array(24);const ledColor=light.ledColor==='cool'?[.6,.8,1]:light.ledColor==='neutral'?[.95,.94,.85]:[1,.62,.24];
      if(light.led)r.modules.filter(m=>m.level==='upper').slice(0,8).forEach((m,i)=>{const center=this.world(m,m.width/2000,-.04,m.depth/1000-.03);pointPos.set(center,i*3);pointColor.set(ledColor.map(c=>c*(Number(light.intensity)||1)*.35),i*3);});
      gl.uniform3fv(this.uniforms['uPointPos[0]'],pointPos);gl.uniform3fv(this.uniforms['uPointColor[0]'],pointColor);
      const room=r.room,W=room.width/1000,D=room.depth/1000,H=room.height/1000;
      this.box([W/2,-.04,D/2],[W,.08,D],r.decors.floor);
      for(const m of r.modules.filter(m=>m.level==='lower')){const c=this.world(m,m.width/2000,.003-m.y/1000,m.depth/2000+.08);gl.depthMask(false);this.box(c,[m.width/1000*1.2,.001,m.depth/1000*1.65],{color:'#000000'},m.run==='B'?Math.PI/2:0,{texture:this.shadow,opacity:1});gl.depthMask(true);}
      this.box([W/2,H/2,-.045],[W,H,.08],r.decors.wall);this.box([-.045,H/2,D/2],[.08,H,D],r.decors.wall);
      if(light.ceiling)this.box([W/2,H+.025,D/2],[W,.05,D],r.decors.ceiling);
      const topY=(r.parameters.leg+r.parameters.lh+r.parameters.topT)/1000;
      for(const run of ['A','B']){const lower=r.modules.filter(m=>m.level==='lower'&&m.run===run);if(!lower.length)continue;const end=Math.max(...lower.map(m=>(run==='A'?m.x:m.z)+m.width))/1000;const start=run==='A'?0:Math.min(...lower.map(m=>m.z))/1000;const len=end-start;this.box(run==='A'?[(start+end)/2,topY+r.parameters.apron/2000,.008]:[.008,topY+r.parameters.apron/2000,(start+end)/2],run==='A'?[len,r.parameters.apron/1000,.016]:[.016,r.parameters.apron/1000,len],{...r.decors.backsplash,pattern:p.backsplashPattern==='tile'?'tile':''});}
      this.hits=[];
      for(const m of r.modules)this.module(m,r,p,bounds);
      for(const top of r.tops)this.box([(top.x+top.width/2)/1000,(top.y+top.thickness/2)/1000,(top.z+top.depth/2)/1000],[top.width/1000,top.thickness/1000,top.depth/1000],r.decors.top,0,{gloss:.25});
      for(const m of r.modules.filter(m=>['sink','oven'].includes(m.type)))this.applianceTop(m,r);
    }
    box(center,size,decor,angle=0,options={}){
      if(size.some(n=>n<=0))return;const gl=this.gl,b=this.buffers[options.cylinder?'cylinder':'cube'];gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);for(let i=0;i<3;i++){gl.enableVertexAttribArray(this.attributes[i]);gl.vertexAttribPointer(this.attributes[i],i===2?2:3,gl.FLOAT,false,32,i===0?0:i===1?12:24);}
      gl.uniformMatrix4fv(this.uniforms.uModel,false,model(center,size,angle));gl.uniform3fv(this.uniforms.uColor,rgb(decor.color));const texture=options.texture||(decor.id||decor.image?this.texture(decor):this.white);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1f(this.uniforms.uTextureMix,texture!==this.white?1:0);gl.uniform1f(this.uniforms.uGloss,options.gloss||0);gl.uniform1f(this.uniforms.uEmission,options.emission||0);gl.uniform1f(this.uniforms.uOpacity,options.opacity??1);gl.drawArrays(gl.TRIANGLES,0,b.count);
    }
    world(m,x,y,z){return m.run==='A'?[m.x/1000+x,m.y/1000+y,m.z/1000+z]:[m.x/1000+z,m.y/1000+y,(m.z+m.width)/1000-x];}
    module(m,r,p,bounds){
      const W=m.width/1000,H=m.height/1000,D=m.depth/1000,T=r.parameters.t/1000,FT=r.parameters.ft/1000,G=r.parameters.g/1000,body=r.decors.body,front=r.decors[m.level],angle=m.run==='B'?Math.PI/2:0;
      const box=(x,y,z,w,h,d,material=body,options={})=>this.box(this.world(m,x,y,z),[w,h,d],material,angle,options);
      if(m.type!=='dishwasher'){
        box(T/2,H/2,D/2,T,H,D);box(W-T/2,H/2,D/2,T,H,D);box(W/2,T/2,D/2,W-2*T,T,D);
        if(!['sink','oven'].includes(m.type))box(W/2,H-T/2,D/2,W-2*T,T,D);else for(const z of [.04,D-.04])box(W/2,H-T/2,z,W-2*T,T,.08);
        if(!['sink','oven'].includes(m.type))box(W/2,H/2,.002,W,H,.004);
        if(m.type==='open')for(let i=0;i<m.shelves;i++)box(W/2,T+(i+1)*(H-2*T)/(m.shelves+1),D/2,W-2*T,T,D-.025);
      }
      if(m.level==='lower'){
        if(p.toeKick&&r.parameters.leg>0)box(W/2,-r.parameters.leg/2000,D-.065,W,r.parameters.leg/1000,.016,r.decors.lower);
        if(m.type!=='dishwasher'&&Number(m.legs)>0&&r.parameters.leg>0)for(const x of [.07,W-.07])for(const z of [.07,D-.07])box(x,-r.parameters.leg/2000,z,.038,r.parameters.leg/1000,.038,{color:'#303333'},{cylinder:true});
      }
      if(m.type==='blind'){
        const blocked=(m.blindWidth-p.cornerClearance)/1000;box(blocked/2,H/2,D+FT/2,blocked-2*G,H-2*G,FT,front);
        if(p.cornerClearance>0)box(blocked+p.cornerClearance/2000,H/2,D+FT/2,p.cornerClearance/1000-2*G,H-2*G,FT,front);
      }
      if(m.fronts){const start=m.type==='blind'?m.blindWidth/1000:0;const fw=(W-start-2*G-(m.fronts-1)*G)/m.fronts;for(let i=0;i<m.fronts;i++){const x=start+G+fw/2+i*(fw+G);box(x,H/2,D+FT/2,fw,H-2*G,FT,front,{gloss:.12});this.handle(box,p,p.handles==='profile'?x:x+fw/2-.045,p.handles==='profile'?H-.015:H*.7,D+FT,fw,false);}}
      if(m.drawers){const fh=(H-2*G-(m.drawers-1)*G)/m.drawers;for(let i=0;i<m.drawers;i++){const y=G+fh/2+i*(fh+G);box(W/2,y,D+FT/2,W-2*G,fh,FT,front,{gloss:.15});this.handle(box,p,W/2,y+fh/2-.04,D+FT,W-2*G,true);}}
      if(m.type==='oven'){
        const nh=m.nicheHeight/1000,base=H-nh;box(W/2,base/2,D+FT/2,W-2*G,Math.max(.01,base-T-2*G),FT,front);
        box(W/2,base+nh/2,D+.027,W-.04,nh-.012,.042,{color:'#171e22'},{gloss:.9});box(W/2,H-.065,D+.052,W-.06,.10,.009,{color:'#969ea2'},{gloss:.9});
        box(W/2,base+nh*.44,D+.052,W-.13,nh*.55,.012,{color:'#0e202c'},{gloss:1});box(W/2,H-.14,D+.08,W-.18,.014,.025,{color:'#adb2b2'},{gloss:1});for(const x of [.10,W-.10])box(x,H-.065,D+.064,.027,.027,.016,{color:'#303739'},{gloss:1});
      }
      if(m.level==='upper'&&p.light?.led){const color=p.light.ledColor==='cool'?'#b5d6ff':p.light.ledColor==='neutral'?'#fff9e8':'#ffd18a';box(W/2,-.009,D-.028,W-.03,.008,.013,{color},{emission:1.5});}
      const center=this.world(m,W/2,H/2,D+.03),clip=this.projectPoint(center,bounds);if(clip)this.hits.push({id:m.id,x:clip.x,y:clip.y,radius:Math.max(22,Math.min(70,bounds.width*W/this.distance*.6))});
    }
    handle(box,p,x,y,z,width,horizontal){
      if(p.handles==='none')return;const color=p.handleColor==='gold'?'#b49b64':p.handleColor==='chrome'?'#aeb8ba':'#303432';
      if(p.handles==='profile')box(x,y,z+.009,Math.max(.03,width-.05),.012,.02,{color},{gloss:.8});else if(p.handles==='knob')box(x,y,z+.016,.026,.026,.026,{color},{gloss:1});else{box(x,y,z+.023,horizontal?.14:.013,horizontal?.013:.14,.014,{color},{gloss:.8});}
    }
    applianceTop(m,r){
      const top=r.tops.find(t=>{const c=this.world(m,m.width/2000,0,m.depth/2000);return c[0]*1000>=t.x&&c[0]*1000<=t.x+t.width&&c[2]*1000>=t.z&&c[2]*1000<=t.z+t.depth;});if(!top)return;
      const y=(top.y+top.thickness)/1000,angle=m.run==='B'?Math.PI/2:0,center=this.world(m,m.width/2000,0,m.depth/2000+.04);center[1]=y+.004;
      if(m.type==='sink'){
        this.box(center,[Math.min(.47,m.width/1000-.05),.01,.38],{color:'#7d8a8d'},angle,{gloss:.9});this.box([center[0],y+.011,center[2]],[.38,.008,.30],{color:'#3d4a4b'},angle,{gloss:.8});
        const tap=this.world(m,m.width/2000,0,.12);tap[1]=y+.11;this.box(tap,[.023,.22,.023],{color:'#b8c2c3'},0,{gloss:1,cylinder:true});const arm=this.world(m,m.width/2000,0,.20);arm[1]=y+.215;this.box(arm,m.run==='A'?[.023,.023,.18]:[.18,.023,.023],{color:'#b8c2c3'},0,{gloss:1});
      }else{
        this.box(center,[Math.min(.54,m.width/1000-.04),.012,.44],{color:'#172020'},angle,{gloss:.9});for(const x of [-.13,.13])for(const z of [-.11,.11]){const c=this.world(m,m.width/2000+x,0,m.depth/2000+.04+z);c[1]=y+.013;this.box(c,[.15,.004,.15],{color:'#3e4543'},0,{cylinder:true,gloss:.7});c[1]=y+.016;this.box(c,[.125,.003,.125],{color:'#151b19'},0,{cylinder:true,gloss:.6});}
      }
    }
    projectPoint(point,bounds){const m=this.viewProjection,c=[...point,1],out=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[r]+=m[k*4+r]*c[k];if(out[3]<=0)return null;return{x:(out[0]/out[3]+1)*bounds.width/2,y:(1-out[1]/out[3])*bounds.height/2};}
    plan2D(bounds){if(!this.ctx)return;const c=this.ctx,ratio=this.canvas.width/bounds.width;c.setTransform(ratio,0,0,ratio,0,0);c.fillStyle='#eef1e9';c.fillRect(0,0,bounds.width,bounds.height);const r=this.result,scale=Math.min((bounds.width-50)/r.room.width,(bounds.height-50)/r.room.depth);this.hits=[];c.strokeStyle='#b7c0b3';c.strokeRect(25,25,r.room.width*scale,r.room.depth*scale);for(const m of [...r.modules.filter(m=>m.level==='lower'),...r.modules.filter(m=>m.level==='upper')]){const x=25+m.x*scale,z=25+m.z*scale,w=(m.run==='A'?m.width:m.depth)*scale,d=(m.run==='A'?m.depth:m.width)*scale;c.globalAlpha=m.level==='upper'?.45:1;c.setLineDash(m.level==='upper'?[5,4]:[]);c.fillStyle=r.decors[m.level].color;c.fillRect(x,z,w,d);c.globalAlpha=1;c.strokeStyle='#52634e';c.strokeRect(x,z,w,d);c.fillStyle='#203c30';c.font='12px system-ui';c.fillText(m.label,x+8,z+(m.level==='upper'?34:20));this.hits.push({id:m.id,x:x+w/2,y:z+d/2,radius:Math.max(20,Math.min(w,d)/2)});}}
    screenshot(){return this.canvas.toDataURL('image/png');}
  }
  const api={KitchenView,multiply,model,geometry,cylinderGeometry};root.KitchenGraphics=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
