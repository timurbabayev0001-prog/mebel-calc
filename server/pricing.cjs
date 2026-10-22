'use strict';
require('../v0.5/catalog.js');
const kitchen = require('../v0.5/kitchen/model.js');
const cabinet=require('../v0.5/calculator.js'),catalog=require('../v0.5/catalog.js'),joinery=require('../v0.5/joinery.js');
const {bases}=require('./options.cjs');
const fields = {sheetPrice:'ЛДСП, ₼/лист',sheetLength:'Длина листа, мм',sheetWidth:'Ширина листа, мм',wastePercent:'Запас ЛДСП, %',topPrice:'Столешница, ₼/пог. м',hingePrice:'Петля, ₼/шт.',guidePrice:'Направляющие, ₼/пара',hangerPrice:'Навес, ₼/шт.',legPrice:'Опора, ₼/шт.',hdfPrice:'ХДФ, ₼/м²',edgePrice:'Кромка с наклейкой, ₼/м',cutPrice:'Распил, ₼/лист',markupPercent:'Работа и наценка, %'};
function validate(r) {
 if (!r || typeof r!=='object' || Array.isArray(r)) throw Error('Неверный прайс');
 for (const k of Object.keys(fields)) {
  if (r[k]===null && ['hdfPrice','edgePrice','cutPrice'].includes(k)) continue;
  if (typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>1000000) throw Error('Проверьте поле: '+fields[k]);
 }
 if (!r.sheetLength||!r.sheetWidth||r.wastePercent>100||r.markupPercent>1000) throw Error('Некорректные размеры или проценты');
 if (!r.hardware||typeof r.hardware!=='object'||Array.isArray(r.hardware)||Object.keys(r.hardware).length>100) throw Error('Неверный прайс фурнитуры');
 for (const [k,v] of Object.entries(r.hardware)) if(k.length>100||(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000))) throw Error('Некорректная цена фурнитуры');
 if(r.cutMode!==undefined&&!['sheet','metre'].includes(r.cutMode))throw Error('Выберите способ оплаты распила');
 if(r.edgeMode!==undefined&&!['combined','separate'].includes(r.edgeMode))throw Error('Выберите способ оплаты кромки');
 if(r.cutMetrePrice!==undefined&&r.cutMetrePrice!==null&&(typeof r.cutMetrePrice!=='number'||!Number.isFinite(r.cutMetrePrice)||r.cutMetrePrice<0||r.cutMetrePrice>1000000))throw Error('Неверная цена распила');
 if(r.operations!==undefined){
  if(!Array.isArray(r.operations)||r.operations.length>100)throw Error('До 100 операций');
  const ids=new Set();
  for(const op of r.operations){
   if(!op||typeof op.id!=='string'||!/^[-a-zA-Z0-9_]{1,60}$/.test(op.id)||ids.has(op.id)||typeof op.name!=='string'||!op.name.trim()||op.name.length>100||typeof op.unit!=='string'||!op.unit.trim()||op.unit.length>20||!Object.hasOwn(bases,op.basis)||typeof op.enabled!=='boolean'||(op.price!==null&&(typeof op.price!=='number'||!Number.isFinite(op.price)||op.price<0||op.price>1000000)))throw Error('Проверьте дополнительные операции');
   ids.add(op.id);
  }
 }
 return r;
}
function quote(project,r,kind="kitchen",quantities={}) {
 validate(r);
 let result;
 if(kind==='cabinet'){
  if(!project||!Array.isArray(project.sections)||project.sections.length<1||project.sections.length>12||(project.extras&&!Array.isArray(project.extras))||(project.hardware&&!Array.isArray(project.hardware)))throw Error('Неверный проект корпуса');
  result=joinery.apply(project,catalog.configure(project,cabinet.calculateProject(project)));
  if(Object.keys(result.errors).length)throw Error(Object.values(result.errors)[0]);
 }else if(kind==='kitchen'){
  if (!project||!Array.isArray(project.modules)||project.modules.length>48||!Array.isArray(project.tops)||project.tops.length>6||!Array.isArray(project.hardware)||project.hardware.length>50) throw Error('Неверный проект');
  result=kitchen.calculate(project);
  if(result.errors.length) throw Error(result.errors[0]);
 }else throw Error('Неизвестный вид проекта');
 if(!quantities||typeof quantities!=='object'||Array.isArray(quantities))throw Error('Неверные количества');
 for(const q of Object.values(quantities))if(typeof q!=='number'||!Number.isFinite(q)||q<0||q>1000000)throw Error('Неверное количество операции');
 const groups=new Map(), lines=[], missing=new Set();
 const add=(name,quantity,price)=>{if(!quantity)return;if(price===null||price===undefined){if(quantity>0)missing.add(name);return;}lines.push({name,quantity,price,total:quantity*price});};
 for(const p of result.parts){
  if(p.material==='Столешница'||p.name==='Столешница'){add('Столешница',p.length*p.quantity/1000,r.topPrice);if(p.thickness!==40)missing.add('Цена столешницы толщиной '+p.thickness+' мм');}
  else if(p.material.startsWith('ЛДСП')){
   const key=p.decor+' · '+p.thickness+' мм';
   if(p.thickness!==18)missing.add('Цена ЛДСП толщиной '+p.thickness+' мм');
   if(Math.min(p.length,p.depth)>Math.min(r.sheetLength,r.sheetWidth)||Math.max(p.length,p.depth)>Math.max(r.sheetLength,r.sheetWidth))throw Error('Деталь не помещается на лист ЛДСП');
   groups.set(key,(groups.get(key)||0)+p.length*p.depth*p.quantity/1e6);
  }else if(p.material==='ХДФ')add('ХДФ',p.length*p.depth*p.quantity/1e6,r.hdfPrice);
  else missing.add('Цена материала: '+p.material);
 }
 for(const [name,area] of groups)add('ЛДСП · '+name,Math.ceil(area*(1+r.wastePercent/100)/(r.sheetLength*r.sheetWidth/1e6)),r.sheetPrice);
 if(r.edgeMode!=='separate')add('Кромка и наклейка',result.totals.edge,r.edgePrice);
 if(r.cutMode==='metre'){if(quantities.cutMetres===undefined)missing.add('Количество метров распила');else add('Распил по метрам',quantities.cutMetres,r.cutMetrePrice??null);}
 else add('Распил',lines.filter(p=>p.name.startsWith('ЛДСП ·')).reduce((s,p)=>s+p.quantity,0),r.cutPrice);
 for(const h of result.hardware){
  const original=h.name;h.name=normalizeHardware(h.name);
  const price=h.name==='Петля мебельная'?r.hingePrice:h.name==='Боковые направляющие'?r.guidePrice:h.name==='Регулируемый навес'?r.hangerPrice:h.name.startsWith('Регулируемая ножка')?r.legPrice:Object.hasOwn(r.hardware,original)?r.hardware[original]:Object.hasOwn(r.hardware,h.name)?r.hardware[h.name]:null;
  add(h.name,h.quantity,price);
 }
 const manual=[];
 if(r.cutMode==='metre')manual.push({id:'cutMetres',name:'Распил',unit:'м'});
 for(const op of r.operations||[]){
  if(!op.enabled||(['edgeMaterial','edgeWork'].includes(op.id)&&r.edgeMode!=='separate'))continue;
  let quantity;
  if(op.basis==='manual'){manual.push({id:op.id,name:op.name,unit:op.unit});quantity=quantities[op.id];if(quantity===undefined){missing.add('Количество: '+op.name);continue;}}
  else quantity=op.basis==='edge'?result.totals.edge:op.basis==='top'?result.parts.filter(p=>p.material==='Столешница'||p.name==='Столешница').reduce((s,p)=>s+p.length*p.quantity/1000,0):op.basis==='parts'?result.parts.reduce((s,p)=>s+p.quantity,0):1;
  add(op.name,quantity,op.price);
 }
 if(r.edgeMode==='separate'&&result.totals.edge>0)for(const id of ['edgeMaterial','edgeWork'])if(!(r.operations||[]).some(op=>op.id===id&&op.enabled))missing.add(id==='edgeMaterial'?'Кромка: материал':'Наклейка кромки');
 const money=n=>Math.round((n+Number.EPSILON)*100)/100;
 const materials=money(lines.reduce((s,l)=>s+l.total,0)),work=money(materials*r.markupPercent/100),total=money(materials+work);
 return {currency:'AZN',incomplete:missing.size>0,materials,work,total,lines,missing:[...missing],manual};
}
function normalizeHardware(name){
 const clean=name.replace(/ · (корпус|полки)$/,'');
 if(/^Конфирмат 7 × 50/.test(clean))return 'Конфирмат 7 × 50';
 if(/^Шуруп 3,5 × 50/.test(clean))return 'Шуруп 3,5 × 50';
 if(/^Шкант 8 × 30/.test(clean))return 'Шкант 8 × 30';
 if(clean.startsWith('Эксцентриковая стяжка'))return 'Эксцентрик + шток';
 return clean;
}
module.exports={quote,validate,fields};
