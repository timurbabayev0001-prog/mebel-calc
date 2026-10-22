(function(root){
 'use strict';
 // Build solids from the same calculated dimensions used in the specification.
 function solids(values,r){
  if(!r.dimensions||!r.layout)return [];
  const {width:w,height:h,depth:d}=r.dimensions,t=r.thickness,out=[];
  const body=r.decors?.body?.color||'#f3f2ee',front=r.decors?.front?.color||'#c8bfb1',top=r.decors?.countertop?.color||'#c3a176';
  const add=(x,y,z,a,b,c,color=body,isFront=false)=>out.push({x,y,z,a,b,c,color,isFront});
  const find=n=>r.parts.find(p=>p.name===n),side=find('Боковина');if(!side)return [];
  add(0,0,0,t,h,side.depth);add(w-t,0,0,t,h,side.depth);
  for(const [name,y] of [['Низ',0],['Верх',h-t]]){const p=find(name);if(p)add(t,y,0,p.length,t,p.depth);}
  const back=r.parts.find(p=>p.name.startsWith('Задняя стенка ·'));
  if(back)add(values.back==='inset'?t:0,values.back==='inset'?t:0,d-back.thickness,back.depth,back.length,back.thickness,'#c2bbaa');
  const divider=find('Вертикальная перегородка');let x=t;
  r.layout.forEach((section,i)=>{
   if(i&&divider)add(x-t,t,0,t,divider.length,divider.depth);
   const name='Секция '+(i+1)+' · ',shelf=find(name+'полка');
   if(shelf){
    const levels=String(values.sections[i].shelfLevels||'').split(';').filter(s=>s.trim()).map(s=>Number(s.trim().replace(',','.')));
    for(let j=0;j<shelf.quantity;j++){
     const base=section.drawerStack+(section.drawerStack?2*Number(values.frontGap??2):0),remaining=h-2*t-base;
     const level=levels.length===shelf.quantity&&levels.every(n=>Number.isFinite(n)&&n>0&&n+t<remaining)?levels[j]:(j+1)*(remaining-shelf.quantity*t)/(shelf.quantity+1)+j*t;
     const y=h-2*t-level,shift=side.depth-(values.back==='inset'?Number(values.backThickness??3):0)-shelf.depth;
     add(x+Number(values.shelfGap??1),y,shift,shelf.length,t,shelf.depth);
    }
   }
   const door=find(name+'дверь'),drawer=find(name+'фасад ящика'),g=Number(values.frontGap??2),inset=values.frontMode==='inset';
   const left=inset?x+g:x-(i? t/2:t)+g,z=inset?g:-Number(values.frontThickness??t);
   if(door)for(let j=0;j<door.quantity;j++)add(left+j*(door.depth+g),inset?t+g:g,z,door.depth,door.length,door.thickness,front,true);
   if(drawer){
    const boxSide=find(name+'боковина ящика'),boxEnd=find(name+'передняя стенка ящика'),bottom=find(name+'дно ящика (накладное)'),gap=Number(values.guideGap??12.5);
    for(let j=0;j<drawer.quantity;j++){
     const y=t+g+j*(drawer.length+g);add(left,y,z,drawer.depth,drawer.length,drawer.thickness,front,true);
     if(boxSide&&boxEnd&&bottom){const bx=x+gap,bz=inset?Number(values.frontThickness??t)+g:0;
      add(bx,y,bz,bottom.length,bottom.thickness,bottom.depth,'#c2bbaa');
      for(const xx of [bx,bx+bottom.length-boxSide.thickness])add(xx,y+bottom.thickness,bz,boxSide.thickness,boxSide.depth,boxSide.length);
      for(const zz of [bz,bz+boxSide.length-boxEnd.thickness])add(bx+boxSide.thickness,y+bottom.thickness,zz,boxEnd.length,boxEnd.depth,boxEnd.thickness);
     }
    }
   }
   x+=section.width+t;
  });
  const counter=find('Столешница');if(counter)add((w-counter.length)/2,h,0,counter.length,counter.thickness,counter.depth,top);
  // Front of model faces camera (positive z). Rear panel was placed at rear in specification coordinates.
  for(const s of out){s.z=d-s.z-s.c;}
  return out;
 }
 class View{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.yaw=-.6;this.pitch=.3;this.zoom=1;this.hiddenFronts=true;this.items=[];this.size={width:800,height:720,depth:500};
   let last;canvas.addEventListener('pointerdown',e=>{last=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!last)return;this.yaw+=(e.clientX-last[0])*.01;this.pitch=Math.max(-1.2,Math.min(1.2,this.pitch+(e.clientY-last[1])*.008));last=[e.clientX,e.clientY];this.draw();});for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,()=>last=null);
   canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.3,Math.min(4,this.zoom*Math.exp(-e.deltaY*.001)));this.draw();},{passive:false});canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')this.yaw-=.1;if(e.key==='ArrowRight')this.yaw+=.1;if(e.key==='ArrowUp')this.pitch=Math.min(1.2,this.pitch+.1);if(e.key==='ArrowDown')this.pitch=Math.max(-1.2,this.pitch-.1);if(['+','='].includes(e.key))this.zoom=Math.min(4,this.zoom*1.1);if(e.key==='-')this.zoom=Math.max(.3,this.zoom/1.1);this.draw();});new ResizeObserver(()=>this.draw()).observe(canvas);
  }
  set hideFronts(v){this.hiddenFronts=v;this.draw();}
  update(values,result,valid){this.items=valid?solids(values,result):[];if(valid)this.size=result.dimensions;this.draw();}
  fit(){this.yaw=-.6;this.pitch=.3;this.zoom=1;this.draw();}
  draw(){
   const c=this.canvas,ctx=this.ctx;if(!ctx)return;const ratio=Math.min(devicePixelRatio||1,2),width=c.clientWidth||600,height=c.clientHeight||360;c.width=width*ratio;c.height=height*ratio;ctx.scale(ratio,ratio);ctx.fillStyle='#e8efeb';ctx.fillRect(0,0,width,height);
   if(!this.items.length){ctx.fillStyle='#43554a';ctx.fillText('Исправьте размеры, чтобы увидеть корпус',20,40);return;}
   const {width:w,height:h,depth:d}=this.size,scale=Math.min(width,height)*.65/Math.max(w,h,d)*this.zoom;
   const project=([x,y,z])=>{x-=w/2;y-=h/2;z-=d/2;const xx=x*Math.cos(this.yaw)+z*Math.sin(this.yaw),zz=-x*Math.sin(this.yaw)+z*Math.cos(this.yaw);return [width/2+xx*scale,height/2-(y*Math.cos(this.pitch)-zz*Math.sin(this.pitch))*scale,zz*Math.cos(this.pitch)+y*Math.sin(this.pitch)];};
   const faces=[];
   for(const b of this.items){if(this.hiddenFronts&&b.isFront)continue;const v=[[b.x,b.y,b.z],[b.x+b.a,b.y,b.z],[b.x+b.a,b.y+b.b,b.z],[b.x,b.y+b.b,b.z],[b.x,b.y,b.z+b.c],[b.x+b.a,b.y,b.z+b.c],[b.x+b.a,b.y+b.b,b.z+b.c],[b.x,b.y+b.b,b.z+b.c]].map(project);
    for(const [indexes,shade] of [[[0,1,2,3],.78],[[4,7,6,5],1],[[0,4,5,1],.65],[[3,2,6,7],1.08],[[0,3,7,4],.88],[[1,5,6,2],.92]]){const points=indexes.map(i=>v[i]);faces.push({points,z:points.reduce((s,p)=>s+p[2],0)/4,color:b.color,shade});}
   }
   faces.sort((a,b)=>b.z-a.z);for(const f of faces){ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();const hex=/^#[a-f0-9]{6}$/i.test(f.color)?f.color:'#deded6';ctx.fillStyle='rgb('+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*f.shade))).join(',')+')';ctx.fill();ctx.strokeStyle='#42544866';ctx.lineWidth=.7;ctx.stroke();}
  }
 }
 const api={solids,View};root.Cabinet3D=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
