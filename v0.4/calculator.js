(function (root) {
  'use strict';
  function calculate(values) {
    const errors = {};
    const dimensions = {};
    for (const key of ['width', 'height', 'depth']) {
      const raw = String(values[key] ?? '').trim();
      const number = Number(raw);
      if (!raw) errors[key] = 'Укажите размер в миллиметрах.';
      else if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number <= 0) errors[key] = 'Введите целое положительное число в миллиметрах.';
      else dimensions[key] = number;
    }
    const thickness = Number(values.thickness);
    if (![16, 18].includes(thickness)) errors.thickness = 'Выберите ЛДСП толщиной 16 или 18 мм.';
    if (!errors.width && !errors.thickness && dimensions.width <= 2 * thickness) errors.width = `Ширина должна быть больше ${2 * thickness} мм, чтобы верх и низ поместились между боковинами.`;
    if (!errors.height && !errors.thickness && dimensions.height <= 2 * thickness) errors.height = `Высота должна быть больше ${2 * thickness} мм, чтобы между верхом и низом оставалось пространство.`;
    if (Object.keys(errors).length) return { errors, parts: [] };
    return { errors, dimensions, thickness, parts: [
      { name: 'Боковина', length: dimensions.height, depth: dimensions.depth, quantity: 2 },
      { name: 'Верх и низ', length: dimensions.width - 2 * thickness, depth: dimensions.depth, quantity: 2 }
    ] };
  }
  // Extended model: rectangular carcass, vertical sections and configurable parts.
  function calculateProject(values) {
    const base = calculate(values);
    if (Object.keys(base.errors).length) return { ...base, warnings: [], totals: null };
    const errors = {}, parts = [], warnings = [];
    for (const key of ['width', 'height', 'depth']) if (base.dimensions[key] > 10000) errors[key] = 'Для одного корпуса допустим размер до 10000 мм.';
    const t = base.thickness, { width: w, height: h, depth: d } = base.dimensions;
    function number(key, fallback, min, max = 10000, source = values) {
      const raw = source[key] ?? fallback;
      const text = String(raw).trim();
      const n = Number(text.replace(',', '.'));
      if (!/^\d+(?:[.,]\d+)?$/.test(text) || !Number.isFinite(n) || n < min || n > max) {
        errors[key] = `Введите число от ${min} до ${max} мм.`;
        return fallback;
      }
      return n;
    }
    function count(key, fallback, max, source = values) {
      const n = number(key, fallback, 0, max, source);
      if (!Number.isInteger(n)) errors[key] = 'Введите целое количество.';
      if (errors[key]) errors[key] = `Введите целое количество от 0 до ${max}.`;
      return n;
    }
    function add(name, length, depth, quantity = 1, material = 'ЛДСП', thickness = t, edgeLong = 0, edgeShort = 0) {
      if (!quantity) return;
      if (!(length > 0 && depth > 0 && thickness > 0)) { errors.geometry = `Деталь «${name}» имеет неположительный размер. Проверьте зазоры и размеры.`; return; }
      parts.push({ name, length, depth, quantity, material, thickness, edgeLong, edgeShort });
    }
    const back = values.back ?? 'none';
    if (!['none', 'overlay', 'inset'].includes(back)) errors.back = 'Выберите способ установки задней стенки.';
    const backThickness = back === 'none' ? 0 : number('backThickness', 3, 1, 18);
    const backGap = back === 'none' ? 0 : number('backGap', 1, 0, 20);
    // Outer depth includes a rear overlay; inset back lies flush with the rear edge.
    const bodyDepth = d - (back === 'overlay' ? backThickness : 0);
    const usableDepth = bodyDepth - (back === 'inset' ? backThickness : 0);
    const frontEdge = values.edge === true || values.edge === 'on';
    add('Боковина', h, bodyDepth, 2, 'ЛДСП', t, frontEdge ? 1 : 0);
    add('Верх', w - 2 * t, bodyDepth, 1, 'ЛДСП', t, frontEdge ? 1 : 0);
    add('Низ', w - 2 * t, bodyDepth, 1, 'ЛДСП', t, frontEdge ? 1 : 0);
    if (back === 'overlay') add('Задняя стенка · накладная', h - 2 * backGap, w - 2 * backGap, 1, 'ХДФ', backThickness);
    if (back === 'inset') add('Задняя стенка · вкладная', h - 2 * t - 2 * backGap, w - 2 * t - 2 * backGap, 1, 'ХДФ', backThickness);
    const sections = values.sections ?? [{ shelves: 0, front: 'none', doors: 1, drawers: 0 }];
    if (!Array.isArray(sections) || sections.length < 1 || sections.length > 12) return { errors: { sections: 'Добавьте от 1 до 12 секций.' }, parts: [], warnings, totals: null };
    const availableWidth = w - (sections.length + 1) * t;
    if (sections.some(s => !s || typeof s !== 'object')) return { errors: { sections: 'Некорректные данные секций.' }, parts: [], warnings, totals: null };
    const custom = values.sectionMode === 'custom';
    let widths = sections.map(() => availableWidth / sections.length);
    if (custom) {
      widths = sections.map((section, i) => number(`sectionWidth${i}`, 0, 1, 10000, { [`sectionWidth${i}`]: section.width }));
      if (Math.abs(widths.reduce((sum, n) => sum + n, 0) - availableWidth) > 0.001) errors.sections = `Сумма чистых ширин секций должна быть ${availableWidth} мм.`;
    }
    if (availableWidth <= 0) errors.sections = 'Для такого количества секций корпус слишком узкий.';
    const innerHeight = h - 2 * t;
    add('Вертикальная перегородка', innerHeight, usableDepth, sections.length - 1, 'ЛДСП', t, frontEdge ? 1 : 0);
    const shelfGap = number('shelfGap', 1, 0, 20);
    const shelfInset = number('shelfInset', 20, 0, 1000);
    const frontGap = number('frontGap', 2, 0, 20);
    const frontThickness = Number(values.frontThickness ?? t);
    if (![16, 18].includes(frontThickness)) errors.frontThickness = 'Выберите толщину фасадов 16 или 18 мм.';
    const frontMode = values.frontMode ?? 'overlay';
    if (!['overlay', 'inset'].includes(frontMode)) errors.frontMode = 'Выберите накладные или вкладные фасады.';
    const hasDrawers = sections.some(s => s.front === 'drawers');
    let guideLength, guideGap, drawerThickness, boxHeight, drawerFrontHeight, bottomThickness, rearGap;
    if (hasDrawers) {
      guideLength = number('guideLength', 400, 100, 1000);
      guideGap = number('guideGap', 12.5, 0, 50);
      drawerThickness = Number(values.drawerThickness ?? 16);
      if (![16, 18].includes(drawerThickness)) errors.drawerThickness = 'Выберите толщину стенок ящика 16 или 18 мм.';
      boxHeight = number('boxHeight', 120, 20, 1000);
      drawerFrontHeight = number('drawerFrontHeight', 180, 30, 1500);
      bottomThickness = number('bottomThickness', 3, 1, 18);
      rearGap = number('rearGap', 10, 0, 100);
      if (guideLength + rearGap + (frontMode === 'inset' ? frontThickness + frontGap : 0) > usableDepth) errors.guideLength = 'Ящик с выбранной длиной направляющих не помещается по глубине.';
      if (boxHeight + bottomThickness + 10 > drawerFrontHeight) errors.boxHeight = 'Высота фасада должна вмещать короб, накладное дно и вертикальный зазор 10 мм.';
      warnings.push('Ящики: деревянный короб для боковых направляющих. Зазор с каждой стороны и длину направляющих сверяйте с документацией выбранной фурнитуры. Петли, крепёж и отверстия не рассчитываются.');
    }
    const layout = [];
    sections.forEach((section, i) => {
      if (!section || typeof section !== 'object') { errors.sections = 'Некорректные данные секции.'; return; }
      const sw = widths[i];
      const shelfCount = count(`shelves${i}`, 0, 30, { [`shelves${i}`]: section.shelves ?? 0 });
      const front = section.front ?? 'none';
      if (!['none', 'doors', 'drawers'].includes(front)) errors.sections = 'Выберите заполнение секции.';
      // Overlay boundaries meet at the centreline of each shared divider.
      const coverage = frontMode === 'inset' ? sw : sw + (i === 0 ? t : t / 2) + (i === sections.length - 1 ? t : t / 2);
      const frontWidth = coverage - 2 * frontGap;
      const frontHeight = (frontMode === 'inset' ? innerHeight : h) - 2 * frontGap;
      let drawerStack = 0;
      if (front === 'doors') {
        const doors = count(`doors${i}`, 1, 4, { [`doors${i}`]: section.doors ?? 1 });
        if (doors < 1) errors[`doors${i}`] = 'Нужна хотя бы одна дверь.';
        add(`Секция ${i + 1} · дверь`, frontHeight, (frontWidth - (doors - 1) * frontGap) / doors, doors, 'ЛДСП', frontThickness, frontEdge ? 2 : 0, frontEdge ? 2 : 0);
      }
      if (front === 'drawers') {
        const drawers = count(`drawers${i}`, 1, 10, { [`drawers${i}`]: section.drawers ?? 1 });
        if (drawers < 1) errors[`drawers${i}`] = 'Нужен хотя бы один ящик.';
        drawerStack = drawers * drawerFrontHeight + Math.max(0, drawers - 1) * frontGap;
        // Require the stack to fit the clear opening even with overlay fronts.
        if (drawerStack + 2 * frontGap > innerHeight) errors[`drawers${i}`] = 'Ящики не помещаются по высоте. Уменьшите количество или высоту фасада.';
        const boxWidth = sw - 2 * guideGap;
        add(`Секция ${i + 1} · фасад ящика`, drawerFrontHeight, frontWidth, drawers, 'ЛДСП', frontThickness, frontEdge ? 2 : 0, frontEdge ? 2 : 0);
        add(`Секция ${i + 1} · боковина ящика`, guideLength, boxHeight, drawers * 2, 'ЛДСП', drawerThickness);
        add(`Секция ${i + 1} · передняя стенка ящика`, boxWidth - 2 * drawerThickness, boxHeight, drawers, 'ЛДСП', drawerThickness);
        add(`Секция ${i + 1} · задняя стенка ящика`, boxWidth - 2 * drawerThickness, boxHeight, drawers, 'ЛДСП', drawerThickness);
        add(`Секция ${i + 1} · дно ящика (накладное)`, boxWidth, guideLength, drawers, 'ХДФ', bottomThickness);
      }
      if (shelfCount > 0 && shelfCount * t >= innerHeight - drawerStack - (drawerStack ? 2 * frontGap : 0)) errors[`shelves${i}`] = 'Полки и ящики не помещаются по высоте секции.';
      const shelfDepth = usableDepth - shelfInset - (frontMode === 'inset' && front !== 'none' ? frontThickness + frontGap : 0);
      add(`Секция ${i + 1} · полка`, sw - 2 * shelfGap, shelfDepth, shelfCount, 'ЛДСП', t, frontEdge ? 1 : 0);
      layout.push({ width: sw, shelves: shelfCount, front, drawerStack });
    });
    const extras = values.extras ?? [];
    if (!Array.isArray(extras) || extras.length > 100) errors.extras = 'Допускается до 100 дополнительных деталей.';
    else extras.forEach((extra, i) => {
      if (!extra || typeof extra !== 'object') { errors.extras = 'Некорректная дополнительная деталь.'; return; }
      const name = String(extra.name ?? '').trim();
      if (!name || name.length > 100) errors[`extraName${i}`] = 'Введите название детали (до 100 символов).';
      const read = (key, fallback, min, max) => number(`extra${key}${i}`, fallback, min, max, { [`extra${key}${i}`]: extra[key] });
      const length = read('length', 100, 1, 10000), depth = read('depth', 100, 1, 10000), thick = read('thickness', t, 1, 100);
      const quantity = count(`extraQuantity${i}`, 1, 100, { [`extraQuantity${i}`]: extra.quantity });
      if (quantity < 1) errors[`extraQuantity${i}`] = 'Количество должно быть не меньше 1.';
      const edgeLong = read('edgeLong', 0, 0, 2), edgeShort = read('edgeShort', 0, 0, 2);
      if (!Number.isInteger(edgeLong) || !Number.isInteger(edgeShort)) errors.extras = 'Число сторон с кромкой должно быть 0, 1 или 2.';
      const material = String(extra.material ?? 'ЛДСП').trim();
      if (!material || material.length > 100) errors.extras = 'Укажите материал (до 100 символов).';
      add(name, length, depth, quantity, material, thick, edgeLong, edgeShort);
    });
    if (Object.keys(errors).length) return { errors, parts: [], warnings, totals: null };
    const materials = new Map();
    let area = 0, edge = 0, quantity = 0;
    for (const part of parts) {
      const a = part.length * part.depth * part.quantity / 1e6;
      const e = (part.length * part.edgeLong + part.depth * part.edgeShort) * part.quantity / 1000;
      area += a; edge += e; quantity += part.quantity;
      const key = `${part.material} · ${part.thickness} мм`;
      materials.set(key, (materials.get(key) ?? 0) + a);
    }
    if (widths.some(n => Math.abs(n - Math.round(n)) > 0.001)) warnings.push('Секции имеют дробную ширину. Размеры не округляются в расчёте; перед изготовлением согласуйте точность раскроя или задайте ширины вручную.');
    return { errors, parts, warnings, dimensions: base.dimensions, thickness: t, layout, totals: { area, edge, quantity, materials: Array.from(materials, ([name, area]) => ({ name, area })) } };
  }
  function toCSV(result) {
    const escape = value => '"' + String(value).replaceAll('"', '""') + '"';
    const rows = [['Деталь', 'Длина, мм', 'Ширина, мм', 'Толщина, мм', 'Материал', 'Количество', 'Кромка по длине, сторон', 'Кромка по ширине, сторон']];
    result.parts.forEach(p => rows.push([p.name, p.length, p.depth, p.thickness, p.material, p.quantity, p.edgeLong, p.edgeShort]));
    return '\ufeff' + rows.map(row => row.map(escape).join(';')).join('\r\n');
  }
  root.MebelCalc = { calculate, calculateProject, toCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MebelCalc;
})(typeof window === 'undefined' ? globalThis : window);
