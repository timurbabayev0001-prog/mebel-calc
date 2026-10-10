'use strict';
const form = document.querySelector('#calculator');
const sectionHost = document.querySelector('#sections');
const extraHost = document.querySelector('#extras');
const status = document.querySelector('#status');
const projectStatus = document.querySelector('#project-status');
let currentResult;
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
  else { input.type = 'text'; input.inputMode = key.startsWith('extraName') || key.startsWith('extramaterial') ? 'text' : 'decimal'; }
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
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Удалить деталь';
    remove.addEventListener('click', () => { const values = read(); values.extras.splice(i, 1); renderExtras(values.extras); update(); });
    card.append(remove); extraHost.append(card);
  });
}
function read() {
  const values = Object.fromEntries(new FormData(form));
  values.sections = [...sectionHost.children].map((_, i) => ({ width: values[`sectionWidth${i}`], shelves: values[`shelves${i}`], front: values[`front${i}`], doors: values[`doors${i}`], drawers: values[`drawers${i}`] }));
  values.extras = [...extraHost.children].map((_, i) => ({ name: values[`extraName${i}`], length: values[`extralength${i}`], depth: values[`extradepth${i}`], thickness: values[`extrathickness${i}`], material: values[`extramaterial${i}`], quantity: values[`extraQuantity${i}`], edgeLong: values[`extraedgeLong${i}`], edgeShort: values[`extraedgeShort${i}`] }));
  return values;
}
function update() {
  const values = read();
  const count = Number(values.sectionCount);
  const countValid = /^\d+$/.test(String(values.sectionCount)) && count >= 1 && count <= 12;
  const result = window.MebelCalc.calculateProject(values);
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
  try { localStorage.setItem('mebel-calc-v02', JSON.stringify({ version: 2, values })); } catch { projectStatus.textContent = 'Браузер не разрешил автосохранение. Используйте «Скачать проект».'; }
  const rows = document.querySelector('#parts'); rows.replaceChildren();
  if (!valid) return;
  document.querySelector('#dimensions').textContent = `${fmt(result.dimensions.width)} × ${fmt(result.dimensions.height)} × ${fmt(result.dimensions.depth)} мм`;
  document.querySelector('#material').textContent = `Корпус: ЛДСП ${result.thickness} мм`;
  document.querySelector('#formula').textContent = `Верх и низ: ${fmt(result.dimensions.width)} − 2 × ${result.thickness} = ${fmt(result.dimensions.width - 2 * result.thickness)} мм`;
  for (const part of result.parts) {
    const row = document.createElement('tr');
    for (const value of [part.name, `${fmt(part.length)} × ${fmt(part.depth)}`, `${part.material} · ${fmt(part.thickness)} мм`, `${part.edgeLong} / ${part.edgeShort}`, `${part.quantity} шт.`]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    rows.append(row);
  }
  document.querySelector('#total-count').textContent = `${result.totals.quantity} шт.`;
  document.querySelector('#total-area').textContent = `${fmt(result.totals.area)} м²`;
  document.querySelector('#total-edge').textContent = `${fmt(result.totals.edge)} м`;
  const materials = document.querySelector('#materials'); materials.replaceChildren();
  for (const material of result.totals.materials) { const item = document.createElement('li'); item.textContent = `${material.name}: ${fmt(material.area)} м²`; materials.append(item); }
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
  if (currentResult && !Object.keys(currentResult.errors).length) download('mebel-calc-specification.csv', window.MebelCalc.toCSV(currentResult), 'text/csv;charset=utf-8');
});
document.querySelector('#print').addEventListener('click', () => window.print());
document.querySelector('#save-project').addEventListener('click', () => download('mebel-calc-project.json', JSON.stringify({ version: 2, values: read() }, null, 2), 'application/json'));
function restore(project) {
  if (project?.version !== 2 || !project.values || !Array.isArray(project.values.sections) || project.values.sections.length < 1 || project.values.sections.length > 12 || !Array.isArray(project.values.extras) || project.values.extras.length > 100 || project.values.sections.some(s => !s || typeof s !== 'object') || project.values.extras.some(s => !s || typeof s !== 'object')) throw new Error('Неверный формат проекта. Откройте JSON, скачанный из версии 0.2.');
  const v = project.values;
  // Reset all globals so omitted imported values do not inherit another project.
  form.reset();
  renderSections(v.sections); renderExtras(v.extras);
  for (const input of form.querySelectorAll('input,select')) {
    if (input.closest('#sections,#extras')) continue;
    if (input.name === 'sectionCount') { input.value = v.sections.length; continue; }
    if (input.type === 'radio') input.checked = String(v[input.name]) === input.value;
    else if (input.type === 'checkbox') input.checked = v[input.name] === 'on' || v[input.name] === true;
    else if (v[input.name] !== undefined && typeof v[input.name] !== 'object') input.value = String(v[input.name]);
  }
}
document.querySelector('#import-project').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 500000) throw new Error('Файл слишком большой. Максимум 500 КБ.');
    restore(JSON.parse(await file.text())); update(); projectStatus.textContent = 'Проект открыт. Проверьте размеры и настройки.';
  } catch (error) { projectStatus.textContent = error.message; }
  event.target.value = '';
});
renderSections([{}]); renderExtras([]);
try { const saved = localStorage.getItem('mebel-calc-v02'); if (saved) restore(JSON.parse(saved)); } catch { projectStatus.textContent = 'Сохранённый проект не удалось восстановить. Открыт новый проект.'; }
update();
