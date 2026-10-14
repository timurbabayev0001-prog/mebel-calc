'use strict';
const form = document.querySelector('#calculator');
const sectionHost = document.querySelector('#sections');
const extraHost = document.querySelector('#extras');
const status = document.querySelector('#status');
const projectStatus = document.querySelector('#project-status');
let currentResult;
let decorState = {};
let hardwareImages = [];
const catalog = window.MebelCatalog;
const fmt = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(value);
function field(parent, key, title, value, options) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = key; label.textContent = title;
  const input = document.createElement(options ? 'select' : 'input');
  input.id = key; input.name = key;
  if (options) for (const [v, text] of options) {
    const option = document.createElement('option'); option.value = v; option.textContent = text; input.append(option);
  }
  else { input.type = 'text'; input.inputMode = key.startsWith('extraName') || key.startsWith('extramaterial') || /^(hardwareName|hardwareArticle|hardwareNote|decorName|countertopMaterial)/.test(key) ? 'text' : 'decimal'; }
  input.value = value;
  input.setAttribute('aria-describedby', `${key}-error`);
  const error = document.createElement('p'); error.id = `${key}-error`; error.className = 'error';
  wrapper.append(label, input, error); parent.append(wrapper);
  return input;
}
const drawerFields = [
  ['guideLength', 'Длина направляющих / короба, мм', 400],
  ['guideGap', 'Зазор под направляющую с каждой стороны, мм', 12.5],
  ['drawerFrontHeight', 'Высота фасада одного ящика, мм', 180],
  ['boxHeight', 'Высота стенок короба, мм', 120],
  ['bottomThickness', 'Толщина накладного дна ХДФ, мм', 3],
  ['rearGap', 'Запас за ящиком, мм', 10]
];
for (const args of drawerFields) field(document.querySelector('#drawer-settings'), ...args);
function renderSections(sections) {
  sectionHost.replaceChildren();
  sections.forEach((section, i) => {
    const card = document.createElement('fieldset'); card.className = 'section-card'; card.dataset.section = i;
    const legend = document.createElement('legend'); legend.textContent = `Секция ${i + 1}`; card.append(legend);
    const width = field(card, `sectionWidth${i}`, 'Чистая ширина секции, мм', section.width ?? 300);
    width.closest('.field').classList.add('custom-width');
    field(card, `shelves${i}`, 'Количество полок', section.shelves ?? 0);
    field(card, `front${i}`, 'Передняя часть', section.front ?? 'none', [['none', 'Открытая секция'], ['doors', 'Распашные двери'], ['drawers', 'Выдвижные ящики']]);
    field(card, `doors${i}`, 'Количество дверей', section.doors ?? 1);
    field(card, `drawers${i}`, 'Количество ящиков', section.drawers ?? 1);
    sectionHost.append(card);
  });
}
function renderExtras(extras) {
  extraHost.replaceChildren();
  extras.forEach((extra, i) => {
    const card = document.createElement('fieldset'); card.className = 'section-card'; card.dataset.extra = i;
    const legend = document.createElement('legend'); legend.textContent = `Дополнительная деталь ${i + 1}`; card.append(legend);
    field(card, `extraName${i}`, 'Название', extra.name ?? 'Дополнительная деталь');
    for (const [key, title, fallback] of [['length', 'Длина, мм', 100], ['depth', 'Ширина, мм', 100], ['thickness', 'Толщина, мм', 16], ['material', 'Материал', 'ЛДСП'], ['Quantity', 'Количество', 1], ['edgeLong', 'Кромка по длине: сторон (0–2)', 0], ['edgeShort', 'Кромка по ширине: сторон (0–2)', 0]]) {
      field(card, `extra${key}${i}`, title, extra[key === 'Quantity' ? 'quantity' : key] ?? fallback);
    }
    field(card, `extraDecor${i}`, 'Декор', extra.decor ?? 'body', [['body', 'Как у корпуса'], ['front', 'Как у фасадов'], ['countertop', 'Как у столешницы']]);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Удалить деталь';
    remove.addEventListener('click', () => { const values = read(); values.extras.splice(i, 1); renderExtras(values.extras); update(); });
    card.append(remove); extraHost.append(card);
  });
}
const roleNames = { body: 'Корпус', front: 'Фасады', countertop: 'Столешница' };
function preview(parent, data, alt) {
  parent.replaceChildren();
  if (data.image) { const image = document.createElement('img'); image.src = data.image; image.alt = alt; parent.append(image); }
  else { const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.backgroundColor = data.color || '#e8e8e0'; swatch.setAttribute('aria-label', alt); parent.append(swatch); }
}
function imageControl(parent, id, getImage, setImage) {
  const holder = document.createElement('div'); holder.className = 'upload-control';
  const sample = document.createElement('div'); sample.className = 'image-preview'; sample.id = `${id}-preview`;
  preview(sample, { image: getImage() }, 'Загруженный образец');
  const label = document.createElement('label'); label.className = 'file-button'; label.textContent = 'Загрузить фото';
  const input = document.createElement('input'); input.type = 'file'; input.id = id; input.accept = 'image/jpeg,image/png,image/webp'; label.append(input);
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Убрать фото';
  const message = document.createElement('p'); message.className = 'muted'; message.setAttribute('role', 'status');
  let uploadVersion = 0;
  input.addEventListener('change', async () => {
    const thisUpload = ++uploadVersion;
    const file = input.files[0]; if (!file) return;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Выберите JPG, PNG или WebP.');
      if (file.size > 5000000) throw new Error('Максимальный размер фотографии — 5 МБ.');
      message.textContent = 'Подготавливаем образец…';
      const url = URL.createObjectURL(file);
      let encoded;
      try {
        const image = new Image();
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Не удалось прочитать изображение.')); image.src = url; });
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Браузер не поддерживает подготовку изображений.');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        encoded = canvas.toDataURL('image/jpeg', 0.75);
        if (!catalog.safeImage(encoded)) throw new Error('Не удалось уменьшить изображение. Выберите файл поменьше.');
      } finally { URL.revokeObjectURL(url); }
      if (!input.isConnected || thisUpload !== uploadVersion) return;
      setImage(encoded); preview(sample, { image: encoded }, 'Загруженный образец'); message.textContent = 'Фото добавлено в проект.'; update();
    } catch (error) { message.textContent = error.message; }
    input.value = '';
  });
  remove.addEventListener('click', () => { uploadVersion++; setImage(''); preview(sample, {}, 'Без фотографии'); message.textContent = 'Фото удалено.'; update(); });
  holder.append(sample, label, remove, message); parent.append(holder);
}
function renderDecor(values = {}) {
  const host = document.querySelector('#decor-settings'); host.replaceChildren(); decorState = {};
  catalog.roles.forEach(role => {
    const saved = catalog.decor(values?.[role]); decorState[role] = saved;
    const card = document.createElement('fieldset'); card.className = 'section-card';
    const legend = document.createElement('legend'); legend.textContent = roleNames[role]; card.append(legend);
    field(card, `decorSelect${role}`, 'Образец', saved.id, [...catalog.presets.map(p => [p.id, p.name]), ['custom', 'Свой декор / изображение']]);
    const custom = document.createElement('div'); custom.id = `decorCustom${role}`;
    field(custom, `decorName${role}`, 'Название / код декора', saved.id === 'custom' ? saved.name : 'Свой декор');
    imageControl(custom, `decorImage${role}`, () => decorState[role].image, image => { decorState[role].image = image; });
    card.append(custom);
    const sample = document.createElement('div'); sample.id = `decorSample${role}`; sample.className = 'decor-sample'; card.append(sample); host.append(card);
  });
}
function syncDecor() {
  catalog.roles.forEach(role => {
    const id = document.getElementById(`decorSelect${role}`).value;
    document.getElementById(`decorCustom${role}`).hidden = id !== 'custom';
    const selected = catalog.decor({ id, name: document.getElementById(`decorName${role}`).value, image: decorState[role].image });
    const sample = document.getElementById(`decorSample${role}`); preview(sample, selected, selected.name);
    const title = document.createElement('span'); title.textContent = selected.name; sample.append(title);
  });
  document.querySelector('#countertop-settings').hidden = !form.elements.countertop.checked;
}
for (const args of [
  ['countertopLength', 'Длина столешницы, мм', 800], ['countertopDepth', 'Глубина столешницы, мм', 500],
  ['countertopThickness', 'Толщина столешницы, мм', 38], ['countertopMaterial', 'Материал столешницы', 'Столешница · ЛДСП']
]) field(document.querySelector('#countertop-settings'), ...args);
function renderHardware(items) {
  const host = document.querySelector('#hardware-settings'); host.replaceChildren(); hardwareImages = items.map(item => catalog.safeImage(item.image));
  items.forEach((item, i) => {
    const card = document.createElement('fieldset'); card.className = 'section-card';
    const legend = document.createElement('legend'); legend.textContent = `Фурнитура ${i + 1}`; card.append(legend);
    field(card, `hardwareName${i}`, 'Название / модель', item.name ?? 'Ручка');
    field(card, `hardwareArticle${i}`, 'Артикул / цвет', item.article ?? '');
    field(card, `hardwareBasis${i}`, 'Способ подсчёта', item.basis ?? 'manual', [['manual', 'Общее количество вручную'], ['fronts', 'На каждый фасад'], ['doors', 'На каждую дверь'], ['drawers', 'На каждый ящик']]);
    field(card, `hardwareQuantity${i}`, 'Количество (или на одну дверь / ящик / фасад)', item.quantity ?? 1);
    field(card, `hardwareUnit${i}`, 'Единица', item.unit ?? 'шт.', [['шт.', 'Штуки'], ['компл.', 'Комплекты'], ['пар', 'Пары']]);
    field(card, `hardwareNote${i}`, 'Примечание: размер, крепление и др.', item.note ?? '');
    imageControl(card, `hardwareImage${i}`, () => hardwareImages[i], image => { hardwareImages[i] = image; });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Удалить позицию';
    remove.addEventListener('click', () => { const items = read().hardware; items.splice(i, 1); renderHardware(items); update(); });
    card.append(remove); host.append(card);
  });
}
document.querySelector('#add-hardware').addEventListener('click', () => {
  const items = read().hardware;
  if (items.length >= 30) { projectStatus.textContent = 'Допускается до 30 позиций фурнитуры.'; return; }
  items.push({}); renderHardware(items); update();
});
function renderCatalogResult(result) {
  const samples = document.querySelector('#decor-summary'); samples.replaceChildren();
  catalog.roles.forEach(role => {
    const card = document.createElement('div'); card.className = 'decor-result';
    preview(card, result.decors[role], result.decors[role].name);
    const title = document.createElement('span'); title.textContent = `${roleNames[role]}: ${result.decors[role].name}${role === 'countertop' && !form.elements.countertop.checked ? ' (не добавлена)' : ''}`; card.append(title); samples.append(card);
  });
  const host = document.querySelector('#hardware-parts'); host.replaceChildren();
  result.hardware.forEach(item => {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    if (item.image) { const image = document.createElement('img'); image.src = item.image; image.alt = item.name; image.className = 'hardware-photo'; name.append(image); }
    const label = document.createElement('span'); label.textContent = item.name; name.append(label); row.append(name);
    for (const value of [item.article || '—', item.note || '—', `${item.quantity} ${item.unit}`]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    host.append(row);
  });
  document.querySelector('#hardware-empty').textContent = result.hardware.length ? 'Автоматическое количество зависит от числа фасадов, дверей и ящиков. Нулевая позиция означает, что соответствующих деталей в проекте нет.' : 'Фурнитура пока не добавлена.';
}
function read() {
  const values = Object.fromEntries(new FormData(form));
  values.sections = [...sectionHost.children].map((_, i) => ({ width: values[`sectionWidth${i}`], shelves: values[`shelves${i}`], front: values[`front${i}`], doors: values[`doors${i}`], drawers: values[`drawers${i}`] }));
  values.extras = [...extraHost.children].map((_, i) => ({ name: values[`extraName${i}`], length: values[`extralength${i}`], depth: values[`extradepth${i}`], thickness: values[`extrathickness${i}`], material: values[`extramaterial${i}`], quantity: values[`extraQuantity${i}`], edgeLong: values[`extraedgeLong${i}`], edgeShort: values[`extraedgeShort${i}`], decor: values[`extraDecor${i}`] }));
  values.decors = Object.fromEntries(catalog.roles.map(role => [role, { id: values[`decorSelect${role}`], name: values[`decorName${role}`], image: decorState[role]?.image || '' }]));
  values.hardware = [...document.querySelector('#hardware-settings').children].map((_, i) => ({ name: values[`hardwareName${i}`], article: values[`hardwareArticle${i}`], note: values[`hardwareNote${i}`], quantity: values[`hardwareQuantity${i}`], basis: values[`hardwareBasis${i}`], unit: values[`hardwareUnit${i}`], image: hardwareImages[i] || '' }));
  return values;
}
function update() {
  const values = read();
  const count = Number(values.sectionCount);
  const countValid = /^\d+$/.test(String(values.sectionCount)) && count >= 1 && count <= 12;
  const result = catalog.configure(values, window.MebelCalc.calculateProject(values));
  if (!countValid || count !== values.sections.length) { result.errors.sectionCount = countValid ? 'Примените количество секций: завершите ввод или нажмите «Рассчитать проект».' : 'Введите целое количество секций от 1 до 12.'; result.parts = []; }
  currentResult = result;
  document.querySelectorAll('.error').forEach(e => { e.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach(e => e.setAttribute('aria-invalid', 'false'));
  for (const [key, message] of Object.entries(result.errors)) {
    const input = document.getElementById(key);
    const error = document.getElementById(`${key}-error`);
    if (input && form.contains(input)) { input.setAttribute('aria-invalid', 'true'); input.closest('details')?.setAttribute('open', ''); }
    if (error) error.textContent = message;
  }
  const valid = Object.keys(result.errors).length === 0;
  document.querySelector('#result-content').hidden = !valid;
  document.querySelector('#empty-state').hidden = valid;
  status.classList.toggle('invalid', !valid);
  status.textContent = valid ? '✓ Спецификация готова' : Object.values(result.errors).join(' ');
  document.querySelector('#section-hint').textContent = `Чистые ширины секций + перегородки + боковины = наружная ширина. ${result.layout ? 'Ширины: ' + result.layout.map(s => fmt(s.width) + ' мм').join(' / ') : ''}`;
  [...sectionHost.children].forEach((card, i) => {
    card.querySelector('.custom-width').hidden = values.sectionMode !== 'custom';
    document.getElementById(`doors${i}`).closest('.field').hidden = values.sections[i].front !== 'doors';
    document.getElementById(`drawers${i}`).closest('.field').hidden = values.sections[i].front !== 'drawers';
  });
  syncDecor();
  try { localStorage.setItem('mebel-calc-v03', JSON.stringify({ version: 3, values })); } catch { projectStatus.textContent = 'Не удалось сохранить проект в браузере: возможно, фотографии заняли доступное место. Нажмите «Скачать проект», чтобы сохранить всё в файл.'; }
  const rows = document.querySelector('#parts'); rows.replaceChildren();
  if (!valid) return;
  document.querySelector('#dimensions').textContent = `${fmt(result.dimensions.width)} × ${fmt(result.dimensions.height)} × ${fmt(result.dimensions.depth)} мм`;
  document.querySelector('#material').textContent = `Корпус: ЛДСП ${result.thickness} мм`;
  document.querySelector('#formula').textContent = `Верх и низ: ${fmt(result.dimensions.width)} − 2 × ${result.thickness} = ${fmt(result.dimensions.width - 2 * result.thickness)} мм`;
  for (const part of result.parts) {
    const row = document.createElement('tr');
    for (const value of [part.name, `${fmt(part.length)} × ${fmt(part.depth)}`, `${part.material} · ${fmt(part.thickness)} мм`, part.decor, `${part.edgeLong} / ${part.edgeShort}`, `${part.quantity} шт.`]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    rows.append(row);
  }
  document.querySelector('#total-count').textContent = `${result.totals.quantity} шт.`;
  document.querySelector('#total-area').textContent = `${fmt(result.totals.area)} м²`;
  document.querySelector('#total-edge').textContent = `${fmt(result.totals.edge)} м`;
  const materials = document.querySelector('#materials'); materials.replaceChildren();
  for (const material of result.totals.materials) { const item = document.createElement('li'); item.textContent = `${material.name}: ${fmt(material.area)} м²`; materials.append(item); }
  renderCatalogResult(result);
  const warnings = document.querySelector('#warnings'); warnings.replaceChildren();
  for (const warning of result.warnings) { const p = document.createElement('p'); p.textContent = warning; warnings.append(p); }
}
function resizeSections() {
  const count = Number(form.elements.sectionCount.value);
  if (!Number.isInteger(count) || count < 1 || count > 12) { update(); return; }
  const sections = read().sections;
  renderSections(Array.from({ length: count }, (_, i) => sections[i] ?? {}));
  update();
}
form.elements.sectionCount.addEventListener('change', resizeSections);
form.addEventListener('input', update);
form.addEventListener('change', event => { if (event.target.name !== 'sectionCount') update(); });
form.addEventListener('submit', event => { event.preventDefault(); resizeSections(); form.querySelector('[aria-invalid="true"]')?.focus(); });
document.querySelector('#add-extra').addEventListener('click', () => {
  const extras = read().extras;
  if (extras.length >= 100) { projectStatus.textContent = 'Допускается до 100 дополнительных деталей.'; return; }
  extras.push({}); renderExtras(extras); update();
});
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector('#download-csv').addEventListener('click', () => {
  if (currentResult && !Object.keys(currentResult.errors).length) download('mebel-calc-specification.csv', catalog.csv(currentResult), 'text/csv;charset=utf-8');
});
document.querySelector('#print').addEventListener('click', () => window.print());
document.querySelector('#save-project').addEventListener('click', () => download('mebel-calc-project.json', JSON.stringify({ version: 3, values: read() }, null, 2), 'application/json'));
function restore(project) {
  if (![2, 3].includes(project?.version) || !project.values || !Array.isArray(project.values.sections) || project.values.sections.length < 1 || project.values.sections.length > 12 || !Array.isArray(project.values.extras) || project.values.extras.length > 100 || project.values.sections.some(s => !s || typeof s !== 'object') || project.values.extras.some(s => !s || typeof s !== 'object')) throw new Error('Неверный формат проекта. Откройте JSON проекта версии 0.2 или 0.3.');
  const v = project.values;
  if (v.hardware !== undefined && (!Array.isArray(v.hardware) || v.hardware.length > 30 || v.hardware.some(item => !item || typeof item !== 'object'))) throw new Error('Некорректный список фурнитуры.');
  // Reset all globals so omitted imported values do not inherit another project.
  form.reset();
  renderSections(v.sections); renderExtras(v.extras); renderDecor(v.decors); renderHardware(v.hardware ?? []);
  for (const input of form.querySelectorAll('input,select')) {
    if (input.type === 'file' || input.closest('#sections,#extras,#decor-settings,#hardware-settings')) continue;
    if (input.name === 'sectionCount') { input.value = v.sections.length; continue; }
    if (input.type === 'radio') input.checked = String(v[input.name]) === input.value;
    else if (input.type === 'checkbox') input.checked = v[input.name] === 'on' || v[input.name] === true;
    else if (v[input.name] !== undefined && typeof v[input.name] !== 'object') input.value = String(v[input.name]);
  }
}
document.querySelector('#import-project').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 16000000) throw new Error('Файл слишком большой. Максимум 16 МБ.');
    restore(JSON.parse(await file.text())); update(); projectStatus.textContent = 'Проект открыт. Проверьте размеры и настройки; при большом количестве фото сохраняйте проект в файл.';
  } catch (error) { projectStatus.textContent = error.message; }
  event.target.value = '';
});
renderSections([{}]); renderExtras([]); renderDecor(); renderHardware([]);
try { const saved = localStorage.getItem('mebel-calc-v03') || localStorage.getItem('mebel-calc-v02'); if (saved) restore(JSON.parse(saved)); } catch { projectStatus.textContent = 'Сохранённый проект не удалось восстановить. Открыт новый проект.'; }
update();
