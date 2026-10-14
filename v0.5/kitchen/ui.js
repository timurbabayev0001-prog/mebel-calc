(function () {
  'use strict';
  const $ = id => document.getElementById(id), key = 'mebel-kitchen-v05';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  const num = value => Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const expanded = new Set();
  let priceTimer, priceRequest = 0;
  let project = KitchenCalc.defaults(), step = 'modules', result, selected = null, filter = '', saveTimer, toastTimer;
  const types = { doors:'Шкаф с дверями', drawers:'Выдвижные ящики', open:'Открытые полки', sink:'Под мойку', oven:'Под духовку', dishwasher:'Посудомоечная машина', blind:'Угловой · глухой угол' };
  const roles = { body:'Корпус', lower:'Нижние фасады и цоколь', upper:'Верхние фасады', top:'Столешница', backsplash:'Фартук', wall:'Стены', floor:'Пол', ceiling:'Потолок' };
  function acceptable(p) { return p && p.version === 5 && ['straight','corner'].includes(p.layout) && Array.isArray(p.modules) && p.modules.length <= 48 && Array.isArray(p.tops) && p.tops.length <= 6 && Array.isArray(p.hardware) && p.hardware.length <= 50 && p.room && typeof p.room === 'object' && p.modules.every(m => m && typeof m === 'object') && p.tops.every(t => t && typeof t === 'object') && p.hardware.every(h => h && typeof h === 'object'); }
  try { const saved = JSON.parse(localStorage.getItem(key)); if (acceptable(saved)) project = { ...KitchenCalc.defaults(), ...saved }; } catch { /* Empty or unavailable storage: start with sample. */ }
  const viewer = new KitchenGraphics.KitchenView($('scene'), $('graphics-message'), id => {
    selected = id; step = 'modules'; renderPanel();
    const card = [...$('panel').querySelectorAll('[data-card]')].find(el => el.dataset.card === id);
    if (card) { card.open = true; card.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
  });
  function read(path) { return path.split('.').reduce((v,k) => v?.[k], project); }
  function write(path, value) { const bits = path.split('.'); let target = project; for (const bit of bits.slice(0,-1)) { if (!target[bit] || typeof target[bit] !== 'object') target[bit] = {}; target = target[bit]; } target[bits.at(-1)] = value; }
  const attrs = (path, scope, index) => scope ? `data-scope="${scope}" data-index="${esc(index)}" data-field="${path}"` : `data-path="${path}"`;
  function field(label, path, value = read(path), scope = '', index = '', text = false) { return `<div class="field"><label>${label}<input ${attrs(path,scope,index)} type="${text?'text':'number'}" ${text?'maxlength="100"':'step="any" inputmode="decimal"'} value="${esc(value)}"></label></div>`; }
  function select(label, path, options, value = read(path), scope = '', index = '') { return `<div class="field"><label>${label}<select ${attrs(path,scope,index)}>${Object.entries(options).map(([id,name]) => `<option value="${id}" ${String(value)===id?'selected':''}>${name}</option>`).join('')}</select></label></div>`; }
  function check(label, path) { return `<label class="check"><input type="checkbox" data-path="${path}" ${read(path)?'checked':''}>${label}</label>`; }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function newModule(level, run) { return { id:uid(level==='lower'?'n':'u'), level, run, name:'Шкаф', type:'doors', width:600, shelves:1, doors:1, drawers:3, legs:level==='lower'?4:0, nicheHeight:600 }; }
  function normalizeCorners() {
    for (const level of ['lower','upper']) {
      const a = project.modules.filter(m => m.level===level && m.run==='A'), b = project.modules.filter(m => m.level===level && m.run==='B');
      if (a.length && b.length && project.layout==='corner') { if (a[0].type!=='blind') { a[0].type='blind'; a[0].name='Глухой угол'; a[0].width=level==='lower'?1000:900; } }
      else if (a[0]?.type==='blind') { a[0].type='doors'; a[0].name='Шкаф'; }
    }
  }
  function moduleCard(m) {
    const group = project.modules.filter(n=>n.level===m.level&&n.run===m.run), index = group.indexOf(m), label = `${m.level==='lower'?'Н':'В'}${m.run}${index+1}`;
    const available = Object.fromEntries(Object.entries(types).filter(([type]) => (m.level==='lower'||['doors','open','blind'].includes(type)) && (type!=='blind'||project.layout==='corner'&&m.run==='A'&&index===0&&project.modules.some(n=>n.level===m.level&&n.run==='B'))));
    const f = (label,path,text=false) => field(label,path,m[path],'module',m.id,text);
    return `<details class="module-card ${selected===m.id?'selected':''}" data-card="${esc(m.id)}" ${selected===m.id||expanded.has(m.id)?'open':''}><summary><span class="badge">${label}</span><span>${esc(m.name)} <small>· ${esc(m.width)} мм</small></span></summary><div class="body">${f('Название','name',true)}<div class="field-grid">${f('Ширина, мм','width')}${select('Тип модуля','type',available,m.type,'module',m.id)}</div><div class="field-grid">${['doors','sink'].includes(m.type)?f('Количество дверей','doors'):''}${['doors','blind','open'].includes(m.type)?f('Количество полок','shelves'):''}${m.type==='drawers'?f('Количество ящиков','drawers'):''}${m.type==='oven'?f('Высота ниши, мм','nicheHeight'):''}${m.level==='lower'&&m.type!=='dishwasher'?f('Количество ножек','legs'):''}</div>${m.type==='blind'?'<p class="hint">Прямоугольный корпус с глухой зоной слева и одной доступной дверью справа. Глухая зона = глубина корпуса + угловой зазор. Размер корпуса и зазор редактируются.</p>':''}${m.type==='dishwasher'?'<p class="hint">Место для встраиваемой машины: считаем фасад и участок столешницы, без корпуса. Крепление фасада задаётся по модели техники.</p>':''}</div></details>`;
  }
  function modulesPanel() {
    return `<h2>Соберите свою кухню</h2><p class="muted">Задайте количество шкафов, затем раскройте каждый и измените его ширину и наполнение.</p>${select('Форма кухни','layout',{straight:'Прямая · одна стена',corner:'Угловая · две стены'})}${['A',...(project.layout==='corner'?['B']:[])].map(run => `<h3 style="margin-top:24px">Стена ${run} ${run==='B'?'· поворот влево':''}</h3>${['lower','upper'].map(level=>{ const group=project.modules.filter(m=>m.level===level&&m.run===run);return `<div class="row-head"><h3>${level==='lower'?'Нижние':'Верхние'} модули</h3><div class="field"><label>Количество<input type="number" min="0" max="12" step="1" inputmode="numeric" data-count="${level}" data-run="${run}" value="${group.length}"></label></div></div>${group.map(moduleCard).join('')}${!group.length?'<p class="muted">Модули можно добавить полем «Количество».</p>':''}`;}).join('')}`).join('')}<details open><summary>Столешница · отдельные части</summary><p class="muted">В углу — прямой стык двух частей. Автоматический размер учитывает свес. Для своих стыков отключите автоматический размер.</p><div class="field"><label>Количество частей<input type="number" min="0" max="6" step="1" inputmode="numeric" data-top-count value="${project.tops.length}"></label></div>${project.tops.map((t,i)=>`<div class="hardware-item"><h3>Часть ${i+1}</h3>${select('Расположение','run',project.layout==='corner'?{A:'Стена A',B:'Стена B'}:{A:'Стена A'},t.run,'top',i)}<label class="check"><input type="checkbox" data-scope="top" data-index="${i}" data-field="auto" ${t.auto?'checked':''}>Автоматический размер</label>${t.auto?`<p class="hint" data-top-hint="${i}"></p>`:`<div class="field-grid">${field('Начало от угла, мм','start',t.start,'top',i)}${field('Длина, мм','length',t.length,'top',i)}${field('Глубина, мм','depth',t.depth,'top',i)}</div>`}</div>`).join('')}</details><a class="hint" style="display:block" href="#specification">Перейти к общей спецификации ↓</a>`;
  }
  function roomPanel() {
    return `<h2>Размеры и конструкция</h2><p class="muted">Все размеры — в мм. Высота корпуса задаётся без ножек и столешницы.</p><h3>Помещение</h3><div class="field-grid">${field('Стена A · ширина','room.width')}${field('Стена B · глубина','room.depth')}${field('Высота потолка','room.height')}</div><h3>Нижние модули</h3><div class="field-grid">${field('Высота корпуса','lowerHeight')}${field('Глубина корпуса','lowerDepth')}${field('Высота ножек','legHeight')}${field('Толщина столешницы','topThickness')}${field('Свес спереди','overhang')}</div>${check('Добавить цоколь по нижнему ряду','toeKick')}<h3>Верхние модули</h3><div class="field-grid">${field('Высота корпуса','upperHeight')}${field('Глубина корпуса','upperDepth')}${field('Фартук · между столешницей и шкафами','backsplashHeight')}</div>${project.layout==='corner'?field('Угловой зазор / добор','cornerClearance'):''}<p class="hint">В угловой кухне ряды B начинаются после глубины соответствующего ряда A и углового зазора. Если на A нет модулей этого уровня, B начинается от угла.</p><details><summary>Материалы, полки и фасады</summary><div class="field-grid">${select('ЛДСП корпуса','thickness',{16:'16 мм',18:'18 мм'})}${field('Толщина фасада','frontThickness')}${field('Зазор фасада','frontGap')}${field('ХДФ · толщина','backThickness')}${field('Зазор полки на сторону','shelfGap')}${field('Отступ полки спереди','shelfInset')}${field('Ширина стяжной планки','railWidth')}</div><p class="muted">Фасады накладные. Задняя стенка накладная; наружная глубина включает ХДФ. Для мойки и духовки — верхние планки вместо сплошного верха, без задней стенки.</p></details><details><summary>Выдвижные ящики</summary><p class="muted">Короб из ЛДСП, накладное дно ХДФ, боковые направляющие. Высота стенки до 120 мм, фасады делят высоту поровну.</p><div class="field-grid">${field('Длина направляющих','guideLength')}${field('Зазор направляющих на сторону','guideGap')}</div><p class="muted">Для скрытых направляющих и металлических систем нужны размеры конкретного производителя.</p></details>`;
  }
  function decorPanel() {
    return `<h2>Материалы и настроение</h2><p class="muted">Корпус, фасады и помещение оформляются отдельно. Загрузите фото своего декора — оно появится на поверхностях в 3D.</p>${select('Поверхность фартука','backsplashPattern',{tile:'Плитка · кладка со смещением',slab:'Сплошная панель / свой рисунок'})}${Object.entries(roles).map(([role,label])=>{const d=MebelCatalog.decor(project.decors?.[role]);return `<div class="decor-card"><div class="decor-head"><div class="swatch" data-swatch="${role}"></div><h3>${label}</h3></div>${select('Образец',role,{...Object.fromEntries(MebelCatalog.presets.map(d=>[d.id,d.name])),custom:'Свой декор / фото'},d.id,'decor',role)}${d.id==='custom'?`${field('Название / код декора','name',project.decors[role]?.name||'Свой декор','decorValue',role,true)}<div class="field"><label>Основной цвет<input type="color" class="color-input" data-scope="decorValue" data-index="${role}" data-field="color" value="${esc(d.color)}"></label></div>`:''}<label class="file-button">${d.image?'Заменить фото':'Загрузить фото декора'}<input type="file" data-image="${role}" accept="image/jpeg,image/png,image/webp"></label>${d.image?`<button class="text-button" data-clear-image="${role}">Убрать фото</button>`:''}</div>`;}).join('')}`;
  }
  function lightPanel() {
    return `<h2>Свет меняет всё</h2><p class="muted">Посмотрите, как сочетаются материалы при разном освещении.</p><div class="light-choices">${[['day','☀','День'],['evening','☾','Вечер'],['studio','◈','Студия']].map(([id,icon,label])=>`<button data-light="${id}" class="${project.light?.mode===id?'active':''}"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</div><div class="field"><label>Яркость света<input class="range" type="range" min="0.3" max="2" step="0.1" data-path="light.intensity" value="${esc(project.light?.intensity||1)}"></label></div>${check('Подсветка под верхними шкафами','light.led')}${select('Температура подсветки','light.ledColor',{warm:'Тёплый · уютный',neutral:'Нейтральный',cool:'Холодный'})}${check('Показать потолок помещения','light.ceiling')}<p class="hint">Для выбора декоров пол и две стены показаны открытым разрезом. Потолок удобнее смотреть спереди. Свет и оттенки — художественная визуализация, без расчёта освещённости.</p>`;
  }
  function hardwarePanel() {
    return `<h2>Фурнитура и крепёж</h2><p class="muted">Петли, ножки, направляющие, полкодержатели и навесы рассчитываются по модулям. Дополнительные позиции добавьте ниже.</p>${select('Сборка корпуса','bodyFixing',{confirmat:'Конфирмат 7 × 50',screw:'Шуруп 3,5 × 50',dowel:'Шкант 8 × 30',eccentric:'Эксцентрик + шток',confirmat_dowel:'Конфирмат + шкант',eccentric_dowel:'Эксцентрик + шкант',none:'Укажу крепёж вручную'})}<div class="field-grid">${field('Крепежей на соединение','bodyPoints')}${field('Петель на дверь','hingesPerDoor')}</div>${select('Ручки фасадов','handles',{bar:'Скобы',knob:'Кнопки',profile:'Отдельный профиль на фасад',none:'Без ручек'})}${select('Цвет ручек','handleColor',{black:'Чёрный',chrome:'Хром',gold:'Латунь'})}<p class="hint">Стеновые анкеры, крепёж столешницы, задних стенок, коробов ящиков, соединительные стяжки и монтажные комплекты техники задавайте по выбранным изделиям. Схемы сверления доступны в режиме отдельного корпуса.</p><h3>Дополнительные позиции</h3>${project.hardware.map((h,i)=>`<div class="hardware-item">${field('Название','name',h.name,'hardware',i,true)}<div class="field-grid">${field('Количество','quantity',h.quantity,'hardware',i)}${select('Единица','unit',{'шт.':'шт.','пар':'пар','компл.':'компл.','м':'м'},h.unit,'hardware',i)}</div>${field('Артикул','article',h.article,'hardware',i,true)}${field('Примечание','note',h.note,'hardware',i,true)}<button class="remove" data-remove-hardware="${i}">Удалить позицию</button></div>`).join('')}<button class="secondary" id="add-hardware">+ Добавить фурнитуру</button>`;
  }
  function renderPanel() {
    $('panel').querySelectorAll('[data-card]').forEach(card=>{if(card.open)expanded.add(card.dataset.card);else expanded.delete(card.dataset.card);});
    document.querySelectorAll('[data-step]').forEach(b=>{b.classList.toggle('active',b.dataset.step===step);b.setAttribute('aria-pressed',String(b.dataset.step===step));});
    $('panel').innerHTML = ({modules:modulesPanel,room:roomPanel,decor:decorPanel,light:lightPanel,hardware:hardwarePanel})[step]();
    refreshSwatches(); refreshHints();
  }
  function refreshSwatches() { $('panel').querySelectorAll('[data-swatch]').forEach(el=>{const d=MebelCatalog.decor(project.decors?.[el.dataset.swatch]);el.style.backgroundColor=d.color;el.style.backgroundImage=d.image?`url("${d.image}")`:d.id==='oak'||d.id==='walnut'?'repeating-linear-gradient(90deg,transparent 0 8px,#3d291512 9px 10px)':'none';}); }
  function refreshHints() { $('panel').querySelectorAll('[data-top-hint]').forEach(el=>{const t=result?.tops[Number(el.dataset.topHint)];el.textContent=t?`${num(t.length)} × ${num(t.boardDepth)} × ${num(t.thickness)} мм · начало ${num(t.run==='A'?t.x:t.z)} мм`:'Размер появится после исправления ошибок.';}); }
  function refresh() {
    result = KitchenCalc.calculate(project); viewer.update(result,project);
    const valid = !result.errors.length; $('invalid-scene').hidden=valid;$('invalid-scene').textContent=valid?'':result.errors[0];
    $('metrics').innerHTML = [['Модули',result.totals?.modules],['Детали',result.totals?.count],['Материалы, м²',result.totals?.area],['Кромка, м',result.totals?.edge]].map(([name,v])=>`<div><b>${v===undefined?'—':num(v)}</b><span>${name}</span></div>`).join('');
    $('errors').hidden=valid;$('errors').innerHTML=result.errors.map(message=>`<p>${esc(message)}</p>`).join('');
    for (const id of ['csv','print','image']) $(id).disabled=!valid;
    renderSpec(); refreshHints(); refreshSwatches(); refreshPrice();
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(key,JSON.stringify(project));$('save-status').textContent='Сохранено на этом устройстве';}catch{$('save-status').textContent='Память браузера недоступна или заполнена. Сохраните проект в файл.';}},350);
  }
  function refreshPrice() {
    clearTimeout(priceTimer); const request = ++priceRequest;
    $('price-range').textContent = result.errors.length ? 'Исправьте размеры' : 'Считаем стоимость…';
    $('price-note').textContent = 'Точная цена — после замера и согласования материалов.';
    if (result.errors.length) return;
    priceTimer = setTimeout(async () => {
      try {
        const response = await fetch('/api/quote', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({project})});
        if (!response.ok) throw Error(); const q = await response.json();
        if (request !== priceRequest) return;
        if (!Number.isFinite(q.min) || !Number.isFinite(q.max) || q.currency !== 'AZN') throw Error();
        $('price-range').textContent = `Примерно ${num(q.min)}–${num(q.max)} ₼`;
        $('price-note').textContent = q.incomplete ? 'Предварительная оценка: часть расходов ещё не учтена. Точная цена — после замера и согласования материалов.' : 'Точная цена — после замера и согласования материалов.';
      } catch {
        if (request !== priceRequest) return;
        $('price-range').textContent = 'Расчёт цены временно недоступен';
        $('price-note').textContent = 'Проектирование кухни доступно. Для оценки стоимости свяжитесь с владельцем.';
      }
    }, 450);
  }
  function renderSpec() {
    if(result.errors.length){$('spec-content').innerHTML='<p class="muted">Исправьте указанные размеры. Общая спецификация появится после проверки всех модулей.</p>';return;}
    if(filter&&!result.modules.some(m=>m.title===filter))filter='';
    const parts=result.parts.filter(p=>!filter||p.module===filter), hardware=result.hardware.filter(p=>!filter||p.module===filter);
    $('spec-content').innerHTML=`<div class="table-toolbar"><label for="module-filter">Показать:</label><select id="module-filter"><option value="">Всю кухню</option>${result.modules.map(m=>`<option value="${esc(m.title)}" ${filter===m.title?'selected':''}>${esc(m.title)}</option>`).join('')}</select><span class="muted">Готовые размеры · Д × Ш · кромка без запаса</span></div><details ${filter?'open':''}><summary>Детали для раскроя · ${parts.reduce((s,p)=>s+p.quantity,0)} шт. · раскрыть таблицу</summary><div class="table-wrap"><table><thead><tr><th>Модуль / деталь</th><th>Размеры, мм</th><th>Толщина</th><th>Материал / декор</th><th>Кол-во</th><th>Кромка Д/Ш</th></tr></thead><tbody>${parts.map(p=>`<tr><td><small>${esc(p.module)}</small>${esc(p.name)}</td><td>${num(p.length)} × ${num(p.depth)}</td><td>${num(p.thickness)} мм</td><td>${esc(p.material)}<small>${esc(p.decor)}</small></td><td>${p.quantity} шт.</td><td>${p.edgeLong} / ${p.edgeShort}</td></tr>`).join('')}</tbody></table></div></details><details ${filter?'open':''}><summary>Фурнитура · ${hardware.length} позиций</summary><div class="table-wrap"><table><thead><tr><th>Модуль</th><th>Название / артикул</th><th>Количество</th><th>Примечание</th></tr></thead><tbody>${hardware.map(h=>`<tr><td>${esc(h.module)}</td><td>${esc(h.name)}<small>${esc(h.article)}</small></td><td>${num(h.quantity)} ${esc(h.unit)}</td><td style="white-space:normal;min-width:180px">${esc(h.note)}</td></tr>`).join('')}</tbody></table></div></details><h3 style="margin-top:22px">Материалы всей кухни · чистая площадь</h3><div class="material-list">${result.totals.materials.map(m=>`<div><span>${esc(m.name)}</span><b>${num(m.area)} м²</b></div>`).join('')}</div><div class="notes"><p>Кромка Д/Ш — число оклеиваемых торцов по длине / ширине детали. Толщина кромки не вычитается из размеров. Площадь без отходов и запаса.</p>${result.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</div>`;
  }
  function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function setCount(level,run,count) {
    const existing=project.modules.filter(m=>m.level===level&&m.run===run);
    if(count<existing.length){const remove=new Set(existing.slice(count).map(m=>m.id));project.modules=project.modules.filter(m=>!remove.has(m.id));}
    while(existing.length<count){const m=newModule(level,run);existing.push(m);project.modules.push(m);}
    normalizeCorners();
  }
  function updateInput(el) {
    const value=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.path){
      if(el.dataset.path==='layout'){
        project.layout=value;
        if(value==='corner'&&!project.modules.some(m=>m.run==='B')){for(const level of ['lower','upper'])for(let i=0;i<2;i++)project.modules.push(newModule(level,'B'));}
        normalizeCorners(); project.tops=project.layout==='corner'?[{id:uid('t'),run:'A',auto:true,thickness:project.topThickness},{id:uid('t'),run:'B',auto:true,thickness:project.topThickness}]:[{id:uid('t'),run:'A',auto:true,thickness:project.topThickness}];
      } else write(el.dataset.path,value);
      if(el.dataset.path==='topThickness')project.tops.forEach(t=>t.thickness=value);
      if(el.dataset.path==='light.ceiling'&&value)viewer.view('front');
    }else if(el.dataset.scope){const scope=el.dataset.scope,index=el.dataset.index;
      if(scope==='module'){const m=project.modules.find(m=>m.id===index);if(m)m[el.dataset.field]=value;}
      if(scope==='top')project.tops[Number(index)][el.dataset.field]=value;
      if(scope==='hardware')project.hardware[Number(index)][el.dataset.field]=value;
      if(scope==='decor'){project.decors??={};project.decors[index]=value==='custom'?{id:'custom',name:'Свой декор',color:MebelCatalog.decor(project.decors[index]).color}:{id:value};}
      if(scope==='decorValue'){project.decors[index][el.dataset.field]=value;}
    }
    refresh();
    if(el.dataset.scope==='module'){const m=project.modules.find(m=>m.id===el.dataset.index),card=el.closest('details');if(m&&card){const span=card.querySelector('summary>span:last-of-type');if(span)span.innerHTML=`${esc(m.name)} <small>· ${esc(m.width)} мм</small>`;}}
  }
  $('panel').addEventListener('input',event=>{const el=event.target;if(el.dataset.path&&el.tagName!=='SELECT'||el.dataset.scope&&el.tagName!=='SELECT'&&el.type!=='checkbox'){updateInput(el);}});
  $('panel').addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.count){const v=Number(el.value);if(!/^\d+$/.test(el.value)||v<0||v>12){notify('Количество модулей: целое число от 0 до 12.');renderPanel();return;}setCount(el.dataset.count,el.dataset.run,v);refresh();renderPanel();viewer.fit();return;}
    if(el.hasAttribute('data-top-count')){const v=Number(el.value);if(!/^\d+$/.test(el.value)||v<0||v>6){notify('Количество частей: целое число от 0 до 6.');renderPanel();return;}project.tops=project.tops.slice(0,v);while(project.tops.length<v)project.tops.push({id:uid('t'),run:project.layout==='corner'&&project.tops.length===1?'B':'A',auto:project.tops.length<2&&project.layout==='corner'||project.tops.length===0,start:0,length:600,depth:Number(project.lowerDepth)+Number(project.overhang),thickness:project.topThickness});refresh();renderPanel();return;}
    if(el.dataset.image){upload(el.files?.[0],el.dataset.image);return;}
    if(el.tagName==='SELECT'||el.type==='checkbox'){updateInput(el);if(el.dataset.path==='layout'||el.dataset.scope==='decor'||el.dataset.scope==='module'&&el.dataset.field==='type'||el.dataset.scope==='top')renderPanel();if(el.dataset.path==='layout')viewer.fit();}
  });
  $('panel').addEventListener('click',event=>{
    const el=event.target.closest('button');if(!el)return;
    if(el.id==='add-hardware'){if(project.hardware.length>=50){notify('До 50 дополнительных позиций.');return;}project.hardware.push({name:'Дополнительный крепёж',quantity:1,unit:'шт.',article:'',note:''});}
    else if(el.dataset.removeHardware!==undefined)project.hardware.splice(Number(el.dataset.removeHardware),1);
    else if(el.dataset.clearImage){const d=project.decors[el.dataset.clearImage];delete d.image;}
    else if(el.dataset.light){project.light??={};project.light.mode=el.dataset.light;}
    else return;
    refresh();renderPanel();
  });
  document.querySelectorAll('[data-step]').forEach(el=>el.addEventListener('click',()=>{step=el.dataset.step;renderPanel();}));
  document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>{viewer.view(el.dataset.view);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===el));}));
  $('fit').addEventListener('click',()=>viewer.fit());
  $('save').addEventListener('click',()=>download(JSON.stringify({kind:'mebel-kitchen',project},null,2),'моя-кухня.json','application/json'));
  $('load').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>6000000)throw Error('Файл слишком большой: до 6 МБ.');const saved=JSON.parse(await file.text());if(saved.kind!=='mebel-kitchen'||!acceptable(saved.project))throw Error('Выберите проект кухни версии 0.5. Файл отдельного корпуса открывается в режиме «Корпус».');project={...KitchenCalc.defaults(),...saved.project};selected=null;filter='';refresh();renderPanel();viewer.fit();notify('Проект кухни открыт.');}catch(error){notify(error.message||'Не удалось открыть проект.');}event.target.value='';});
  $('reset').addEventListener('click',()=>{if(!window.confirm('Начать новый проект? Сначала сохраните текущую кухню в файл, если хотите оставить её.'))return;project=KitchenCalc.defaults();selected=null;filter='';refresh();renderPanel();viewer.fit();});
  $('csv').addEventListener('click',()=>download(KitchenCalc.csv(result),'спецификация-кухни.csv','text/csv;charset=utf-8'));
  $('image').addEventListener('click',()=>{viewer.render();const a=document.createElement('a');a.href=viewer.screenshot();a.download='моя-кухня.png';a.click();});
  function printImage(){if(result.errors.length)return;viewer.render();let image=$('print-image');if(!image){image=document.createElement('img');image.id='print-image';image.alt='Визуализация кухни';$('specification').prepend(image);}image.src=viewer.screenshot();}
  $('print').addEventListener('click',()=>{filter='';renderSpec();document.querySelectorAll('#spec-content details').forEach(el=>el.open=true);printImage();window.print();});
  window.addEventListener('beforeprint',printImage);
  $('spec-content').addEventListener('change',event=>{if(event.target.id==='module-filter'){filter=event.target.value;renderSpec();}});
  async function upload(file,role){
    if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5000000){notify('Выберите JPG, PNG или WebP до 5 МБ.');return;}
    const captured=project,url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{try{if(project!==captured)return;const canvas=document.createElement('canvas'),scale=Math.min(1,640/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.75);if(!MebelCatalog.safeImage(data))throw Error();project.decors??={};project.decors[role]={id:'custom',name:file.name.replace(/\.[^.]+$/,'').slice(0,80),color:MebelCatalog.decor(project.decors[role]).color,image:data};refresh();renderPanel();notify('Декор добавлен в проект и визуализацию.');}catch{notify('Не удалось обработать фото. Попробуйте изображение меньшего размера.');}finally{URL.revokeObjectURL(url);}};
    image.onerror=()=>{URL.revokeObjectURL(url);notify('Не удалось прочитать изображение.');};image.src=url;
  }
  refresh();renderPanel();viewer.fit();
})();
