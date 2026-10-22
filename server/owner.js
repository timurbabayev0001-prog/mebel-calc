'use strict';
const $=id=>document.getElementById(id);let loaded,selectedProject;
async function api(url,data){const r=await fetch(url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const b=await r.json();if(!r.ok)throw Error(b.error||'Не удалось выполнить запрос');return b;}
function input(label,value='',type='text'){const l=document.createElement('label'),i=document.createElement('input');l.textContent=label;i.type=type;i.value=value??'';i.setAttribute('aria-label',label);if(type==='number'){i.min=0;i.step='any';}l.append(i);return {l,i};}
function row(name='',price=''){const d=document.createElement('div');d.className='rate-row';const n=input('Название',name),p=input('Цена за единицу, ₼',price,'number'),b=document.createElement('button');b.textContent='Удалить';b.type='button';b.onclick=()=>d.remove();d.append(n.l,p.l,b);$('hardware').append(d);}
function operation(op){const d=document.createElement('div');d.className='operation';d.dataset.id=op.id;
 const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=op.enabled;enabled.dataset.enabled='';const el=document.createElement('label');el.append(enabled,' Включить в расчёт');
 const name=input('Статья',op.name),price=input('Цена, ₼',op.price,'number'),unit=input('Единица',op.unit),basis=document.createElement('select');basis.setAttribute('aria-label','Способ подсчёта');for(const [id,text] of Object.entries(loaded.options.bases)){const o=new Option(text,id);basis.append(o);}basis.value=op.basis;name.i.dataset.name='';price.i.dataset.price='';unit.i.dataset.unit='';basis.dataset.basis='';
 const b=document.createElement('button');b.type='button';b.textContent='Удалить статью';b.onclick=()=>d.remove();d.append(el,name.l,price.l,unit.l,basis,b);$('operations').append(d);
}
async function load(){loaded=await api('/api/prices');$('fields').replaceChildren();for(const [k,text] of Object.entries(loaded.fields)){const {l,i}=input(text,loaded.rates[k],'number');i.dataset.key=k;i.required=!['hdfPrice','edgePrice','cutPrice'].includes(k);$('fields').append(l);}
 $('cut-mode').value=loaded.rates.cutMode||'sheet';$('edge-mode').value=loaded.rates.edgeMode||'combined';$('cut-metre-price').value=loaded.rates.cutMetrePrice??'';
 $('hardware').replaceChildren();const h=loaded.rates.hardware;for(const n of new Set([...loaded.options.hardwareNames,...Object.keys(h)]))row(n,Object.hasOwn(h,n)?h[n]:null);
 $('operations').replaceChildren();const ops=new Map(loaded.options.templates.map(o=>[o.id,o]));for(const o of loaded.rates.operations||[])ops.set(o.id,o);for(const op of ops.values())operation(op);
 $('editor').hidden=false;$('login').hidden=true;
}
$('login').onsubmit=async e=>{e.preventDefault();try{await api('/api/login',{password:$('password').value});$('password').value='';await load();$('status').textContent='Вы вошли.';}catch(e){$('status').textContent=e.message;}};
$('logout').onclick=async()=>{try{await api('/api/logout',{});$('editor').hidden=true;$('fields').replaceChildren();$('hardware').replaceChildren();$('operations').replaceChildren();$('quote').replaceChildren();$('quantities').replaceChildren();$('project').value='';$('login').hidden=false;selectedProject=null;loaded=null;$('status').textContent='Вы вышли.';}catch(e){$('status').textContent=e.message;}};
$('add').onclick=()=>row();$('add-operation').onclick=()=>operation({id:'custom_'+crypto.randomUUID(),name:'Своя статья',price:null,unit:'шт.',basis:'manual',enabled:false});
$('prices').onsubmit=async e=>{e.preventDefault();try{const r={...loaded.rates,hardware:Object.create(null),operations:[]};for(const i of $('fields').querySelectorAll('input'))r[i.dataset.key]=i.value===''?null:Number(i.value);r.cutMode=$('cut-mode').value;r.edgeMode=$('edge-mode').value;r.cutMetrePrice=$('cut-metre-price').value===''?null:Number($('cut-metre-price').value);
 for(const d of $('hardware').children){const [n,p]=d.querySelectorAll('input');if(!n.value.trim())throw Error('Укажите название фурнитуры');if(Object.hasOwn(r.hardware,n.value.trim()))throw Error('Название повторяется');r.hardware[n.value.trim()]=p.value===''?null:Number(p.value);}
 for(const d of $('operations').children)r.operations.push({id:d.dataset.id,name:d.querySelector('[data-name]').value.trim(),unit:d.querySelector('[data-unit]').value.trim(),price:d.querySelector('[data-price]').value===''?null:Number(d.querySelector('[data-price]').value),enabled:d.querySelector('[data-enabled]').checked,basis:d.querySelector('[data-basis]').value});
 await api('/api/prices',r);loaded.rates=r;$('quote').replaceChildren();$('quantities').replaceChildren();$('status').textContent='Прайс сохранён. Если проект уже выбран, нажмите «Пересчитать заказ».';
 }catch(e){$('status').textContent=e.message;}};
async function calculate(){if(!selectedProject)return;try{
 const quantities=Object.create(null);for(const i of $('quantities').querySelectorAll('input'))if(i.value!=='')quantities[i.dataset.id]=Number(i.value);
 const q=await api('/api/owner-quote',{...selectedProject,quantities});const money=v=>v.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₼';
 $('quantities').replaceChildren();for(const item of q.manual){const {l,i}=input(item.name+' ('+item.unit+')',quantities[item.id],'number');i.dataset.id=item.id;$('quantities').append(l);}
 $('quote').textContent=`Материалы, обработка и включённые расходы: ${money(q.materials)}\nРабота и наценка: ${money(q.work)}\nОриентировочная стоимость: ${money(q.total)}\nНе учтено: ${q.missing.join(', ')||'нет'}\n\n`+q.lines.map(l=>`${l.name}: ${l.quantity.toLocaleString('ru-RU',{maximumFractionDigits:3})} × ${money(l.price)} = ${money(l.total)}`).join('\n');
 $('recalculate').hidden=false;
 }catch(e){$('quote').textContent=e.message;}}
$('project').onchange=async e=>{try{selectedProject=null;$('quote').replaceChildren();$('quantities').replaceChildren();const f=e.target.files[0];if(!f||f.size>16000000)throw Error('Выберите проект до 16 МБ');const d=JSON.parse(await f.text());if(d.kind==='mebel-kitchen')selectedProject={kind:'kitchen',project:d.project};else if([2,3,4].includes(d.version)&&d.values)selectedProject={kind:'cabinet',project:d.values};else throw Error('Выберите сохранённый проект кухни или корпуса');await calculate();}catch(e){$('quote').textContent=e.message;}};
$('recalculate').onclick=calculate;load().catch(()=>{});
