'use strict';
require('../v0.5/catalog.js');
const kitchen = require('../v0.5/kitchen/model.js');
const fields = {sheetPrice:'ЛДСП, ₼/лист',sheetLength:'Длина листа, мм',sheetWidth:'Ширина листа, мм',wastePercent:'Запас ЛДСП, %',topPrice:'Столешница, ₼/пог. м',hingePrice:'Петля, ₼/шт.',guidePrice:'Направляющие, ₼/пара',hangerPrice:'Навес, ₼/шт.',legPrice:'Опора, ₼/шт.',hdfPrice:'ХДФ, ₼/м²',edgePrice:'Кромка с наклейкой, ₼/м',cutPrice:'Распил, ₼/лист',markupPercent:'Работа и наценка, %',rangePercent:'Диапазон ± %',rounding:'Округление границ, ₼'};
function validate(r) {
 if (!r || typeof r!=='object' || Array.isArray(r)) throw Error('Неверный прайс');
 for (const k of Object.keys(fields)) {
  if (r[k]===null && ['hdfPrice','edgePrice','cutPrice'].includes(k)) continue;
  if (typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>1000000) throw Error('Проверьте поле: '+fields[k]);
 }
 if (!r.sheetLength||!r.sheetWidth||!r.rounding||r.rangePercent>90||r.wastePercent>100||r.markupPercent>1000) throw Error('Некорректные размеры или проценты');
 if (!r.hardware||typeof r.hardware!=='object'||Array.isArray(r.hardware)||Object.keys(r.hardware).length>100) throw Error('Неверный прайс фурнитуры');
 for (const [k,v] of Object.entries(r.hardware)) if(k.length>100||typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000) throw Error('Некорректная цена фурнитуры');
 return r;
}
function quote(project,r) {
 validate(r);
 if (!project||!Array.isArray(project.modules)||project.modules.length>48||!Array.isArray(project.tops)||project.tops.length>6||!Array.isArray(project.hardware)||project.hardware.length>50) throw Error('Неверный проект');
 const result=kitchen.calculate(project);
 if(result.errors.length) throw Error(result.errors[0]);
 const groups=new Map(), lines=[], missing=new Set();
 const add=(name,quantity,price)=>{if(price===null||price===undefined){if(quantity>0)missing.add(name);return;}lines.push({name,quantity,price,total:quantity*price});};
 for(const p of result.parts){
  if(p.material.startsWith('ЛДСП')){
   const key=p.decor+' · '+p.thickness+' мм';
   if(p.thickness!==18)missing.add('Цена ЛДСП толщиной '+p.thickness+' мм');
   if(Math.min(p.length,p.depth)>Math.min(r.sheetLength,r.sheetWidth)||Math.max(p.length,p.depth)>Math.max(r.sheetLength,r.sheetWidth))throw Error('Деталь не помещается на лист ЛДСП');
   groups.set(key,(groups.get(key)||0)+p.length*p.depth*p.quantity/1e6);
  }else if(p.material==='ХДФ')add('ХДФ',p.length*p.depth*p.quantity/1e6,r.hdfPrice);
  else if(p.material==='Столешница'){add('Столешница',p.length*p.quantity/1000,r.topPrice);if(p.thickness!==40)missing.add('Цена столешницы толщиной '+p.thickness+' мм');}
 }
 for(const [name,area] of groups)add('ЛДСП · '+name,Math.ceil(area*(1+r.wastePercent/100)/(r.sheetLength*r.sheetWidth/1e6)),r.sheetPrice);
 add('Кромка и наклейка',result.totals.edge,r.edgePrice);
 add('Распил',lines.filter(p=>p.name.startsWith('ЛДСП ·')).reduce((s,p)=>s+p.quantity,0),r.cutPrice);
 for(const h of result.hardware){
  const price=h.name==='Петля мебельная'?r.hingePrice:h.name==='Боковые направляющие'?r.guidePrice:h.name==='Регулируемый навес'?r.hangerPrice:h.name.startsWith('Регулируемая ножка')?r.legPrice:Object.hasOwn(r.hardware,h.name)?r.hardware[h.name]:null;
  add(h.name,h.quantity,price);
 }
 const materials=lines.reduce((s,l)=>s+l.total,0), work=materials*r.markupPercent/100,total=materials+work;
 const min=Math.floor(total*(1-r.rangePercent/100)/r.rounding)*r.rounding,max=Math.ceil(total*(1+r.rangePercent/100)/r.rounding)*r.rounding;
 return {currency:'AZN',min,max,incomplete:missing.size>0,materials,work,total,lines,missing:[...missing]};
}
module.exports={quote,validate,fields};
