(function(root){
 'use strict';
 root.MebelPrice={create(container,kind){
  let timer,serial=0;
  const heading=document.createElement('p'),value=document.createElement('h2'),note=document.createElement('p');
  heading.textContent='Ориентировочная стоимость';heading.className='eyebrow';container.append(heading,value,note);
  return function(project,valid=true){
   clearTimeout(timer);const id=++serial;value.textContent=valid?'Считаем…':'Исправьте размеры';note.textContent='';if(!valid)return;
   const body=JSON.stringify({kind,project});
   timer=setTimeout(async()=>{try{
    const r=await fetch('/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body});if(!r.ok)throw Error();const q=await r.json();if(id!==serial)return;
    if(!Number.isFinite(q.total)||q.currency!=='AZN')throw Error();
    value.textContent=q.total.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₼';
    note.textContent=q.incomplete?'Часть расходов ещё не учтена. Точная цена — после проверки комплектации и замера.':'По выбранной комплектации. Точная цена — после проверки и замера.';
   }catch{if(id!==serial)return;value.textContent='Расчёт цены временно недоступен';note.textContent='Проектирование доступно. Для цены запустите сервер или свяжитесь с владельцем.';}},350);
  };
 }};
})(window);
