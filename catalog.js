(function (root) {
  'use strict';
  const presets = [
    { id: 'white', name: 'Белый', color: '#f3f2ee' },
    { id: 'oak', name: 'Дуб натуральный', color: '#c3a176' },
    { id: 'walnut', name: 'Орех', color: '#77523c' },
    { id: 'cashmere', name: 'Кашемир', color: '#c8bfb1' },
    { id: 'graphite', name: 'Графит', color: '#494c4b' }
  ];
  const roles = ['body', 'front', 'countertop'];
  function safeImage(value) {
    return typeof value === 'string' && value.length <= 350000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
  }
  function decor(value) {
    const preset = presets.find(p => p.id === value?.id) || presets[0];
    if (value?.id !== 'custom') return { ...preset, image: '' };
    return { id: 'custom', name: String(value.name || 'Свой декор').trim().slice(0, 100), color: /^#[a-f\d]{6}$/i.test(value.color || '') ? value.color : '#deded6', image: safeImage(value.image) };
  }
  function configure(values, base) {
    const errors = { ...base.errors };
    if (Object.keys(errors).length) return { ...base, hardware: [], decors: {} };
    const decors = Object.fromEntries(roles.map(role => [role, decor(values.decors?.[role])]));
    const extraStart = base.parts.length - (values.extras?.length || 0);
    const parts = base.parts.map((part, index) => {
      const extra = index >= extraStart ? values.extras?.[index - extraStart] : null;
      const role = extra && roles.includes(extra.decor) ? extra.decor : (/дверь|фасад ящика/.test(part.name) ? 'front' : 'body');
      return { ...part, decor: part.material === 'ХДФ' && !extra ? 'Без выбранного декора' : decors[role].name };
    });
    const numeric = (key, fallback, min, max) => {
      const raw = String(values[key] ?? fallback).trim();
      const n = Number(raw.replace(',', '.'));
      if (!/^\d+(?:[.,]\d+)?$/.test(raw) || n < min || n > max || !Number.isFinite(n)) { errors[key] = `Введите число от ${min} до ${max}.`; return fallback; }
      return n;
    };
    if (values.countertop === true || values.countertop === 'on') {
      const length = numeric('countertopLength', base.dimensions.width, 1, 10000);
      const depth = numeric('countertopDepth', base.dimensions.depth, 1, 10000);
      const thickness = numeric('countertopThickness', 38, 1, 100);
      const material = String(values.countertopMaterial ?? 'Столешница · ЛДСП').trim();
      if (!material || material.length > 100) errors.countertopMaterial = 'Укажите материал столешницы (до 100 символов).';
      parts.push({ name: 'Столешница', length, depth, thickness, material, quantity: 1, edgeLong: 0, edgeShort: 0, decor: decors.countertop.name });
    }
    const fronts = base.parts.filter(p => /дверь|фасад ящика/.test(p.name)).reduce((s, p) => s + p.quantity, 0);
    const doors = base.parts.filter(p => /дверь/.test(p.name)).reduce((s, p) => s + p.quantity, 0);
    const drawers = base.parts.filter(p => /фасад ящика/.test(p.name)).reduce((s, p) => s + p.quantity, 0);
    const counts = { manual: 1, fronts, doors, drawers };
    const items = values.hardware ?? [];
    const hardware = [];
    if (!Array.isArray(items) || items.length > 30) errors.hardware = 'Допускается до 30 позиций фурнитуры.';
    else items.forEach((item, i) => {
      if (!item || typeof item !== 'object') { errors.hardware = 'Некорректная позиция фурнитуры.'; return; }
      const name = String(item.name ?? '').trim();
      if (!name || name.length > 100) errors[`hardwareName${i}`] = 'Укажите название (до 100 символов).';
      const basis = item.basis ?? 'manual', unit = item.unit ?? 'шт.';
      if (!Object.hasOwn(counts, basis) || !['шт.', 'компл.', 'пар'].includes(unit)) errors.hardware = 'Выберите способ подсчёта и единицу фурнитуры.';
      const raw = String(item.quantity ?? 1).trim();
      const quantity = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) errors[`hardwareQuantity${i}`] = 'Введите целое количество от 1 до 10000.';
      const article = String(item.article ?? '').trim(), note = String(item.note ?? '').trim();
      if (article.length > 100 || note.length > 300) errors.hardware = 'Артикул: до 100 символов; примечание: до 300.';
      hardware.push({ name, article, note, quantity: quantity * (counts[basis] ?? 0), unit, basis, image: safeImage(item.image) });
    });
    if (Object.keys(errors).length) return { ...base, errors, parts: [], hardware: [], decors, totals: null };
    const materials = new Map();
    let area = 0, edge = 0, quantity = 0;
    parts.forEach(p => {
      const a = p.length * p.depth * p.quantity / 1e6;
      const key = `${p.material} · ${p.thickness} мм · ${p.decor}`;
      materials.set(key, (materials.get(key) || 0) + a);
      area += a; edge += (p.length * p.edgeLong + p.depth * p.edgeShort) * p.quantity / 1000; quantity += p.quantity;
    });
    return { ...base, errors, parts, hardware, decors, totals: { area, edge, quantity, materials: Array.from(materials, ([name, area]) => ({ name, area })) } };
  }
  function csv(result) {
    const escape = v => '"' + String(typeof v === 'string' && /^[=+@\-\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
    const rows = [['Тип', 'Название', 'Длина, мм', 'Ширина, мм', 'Толщина, мм', 'Материал', 'Декор / артикул', 'Количество', 'Единица', 'Кромка по длине', 'Кромка по ширине', 'Примечание']];
    result.parts.forEach(p => rows.push(['Деталь', p.name, p.length, p.depth, p.thickness, p.material, p.decor, p.quantity, 'шт.', p.edgeLong, p.edgeShort, '']));
    result.hardware.forEach(p => rows.push(['Фурнитура', p.name, '', '', '', '', p.article, p.quantity, p.unit, '', '', p.note]));
    return '\ufeff' + rows.map(r => r.map(escape).join(';')).join('\r\n');
  }
  const api = { presets, roles, safeImage, decor, configure, csv };
  root.MebelCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
