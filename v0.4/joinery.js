(function (root) {
  'use strict';
  const methods = [['none', 'Не рассчитывать'], ['screw', 'Шурупы 3,5 × 50 мм'], ['confirmat', 'Конфирматы 7 × 50 мм'], ['eccentric', 'Эксцентрики: Ø16 / Minifix / Rastex'], ['dowel', 'Шканты 8 × 30 мм'], ['confirmat_dowel', 'Конфирматы + шканты'], ['eccentric_dowel', 'Эксцентрики + шканты']];
  function apply(values, base) {
    if (Object.keys(base.errors).length) return { ...base, drilling: { errors: {}, panels: [] } };
    const errors = { ...base.errors }, hardware = [...base.hardware];
    const bodyMethod = values.bodyFixing ?? 'none', shelfMethod = values.shelfFixing ?? 'none';
    const allowed = methods.map(m => m[0]);
    if (!allowed.includes(bodyMethod)) errors.bodyFixing = 'Выберите крепление корпуса.';
    if (![...allowed, 'supports'].includes(shelfMethod)) errors.shelfFixing = 'Выберите крепление полок.';
    function count(key, fallback) {
      const raw = String(values[key] ?? fallback).trim(), n = Number(raw);
      if (!/^\d+$/.test(raw) || n < 1 || n > 10) { errors[key] = 'Введите целое количество от 1 до 10 на соединение.'; return fallback; }
      return n;
    }
    const bodyPoints = bodyMethod === 'none' ? 0 : count('bodyPoints', 2);
    const shelfPoints = shelfMethod === 'none' ? 0 : count('shelfPoints', 2);
    const bodyJoints = 4 + Math.max(0, base.layout.length - 1) * 2;
    const shelfCount = base.layout.reduce((s, section) => s + section.shelves, 0);
    function addHardware(method, n, area) {
      if (method === 'none' || !n) return;
      const add = (name, unit = 'шт.') => hardware.push({ name: `${name} · ${area}`, article: String(values[area === 'корпус' ? 'bodyArticle' : 'shelfArticle'] ?? values.fixingArticle ?? '').trim().slice(0, 100), note: `${area}: автоматически, количество точек задано пользователем.`, quantity: n, unit, basis: 'joinery', image: '' });
      if (method === 'screw') add('Шуруп 3,5 × 50 мм');
      if (method.includes('confirmat')) add('Конфирмат 7 × 50 мм');
      if (method.includes('eccentric')) add('Эксцентриковая стяжка (эксцентрик + шток)', 'компл.');
      if (method.includes('dowel')) add('Шкант 8 × 30 мм');
      if (method === 'supports') add('Полкодержатель');
    }
    addHardware(bodyMethod, bodyJoints * bodyPoints, 'корпус');
    addHardware(shelfMethod, shelfCount * 2 * shelfPoints, 'полки');
    if (Object.keys(errors).length) return { ...base, errors, parts: [], hardware: [], totals: null, drilling: { errors: {}, panels: [] } };
    const result = { ...base, hardware, joinery: { bodyMethod, shelfMethod, bodyJoints, shelfCount, bodyPoints, shelfPoints }, drilling: { errors: {}, panels: [] } };
    if (!(values.drilling === true || values.drilling === 'on')) return result;
    result.drilling = drill(values, result);
    return result;
  }
  function drill(values, base) {
    const errors = {}, panels = [];
    const { bodyMethod, shelfMethod, bodyPoints, shelfPoints } = base.joinery;
    const methodsUsed = [bodyMethod, base.joinery.shelfCount ? shelfMethod : 'none'];
    const t = base.thickness, h = base.dimensions.height, ih = h - 2 * t;
    const top = base.parts.find(p => p.name === 'Верх');
    if (base.joinery.shelfCount > 100) return { errors: { drilling: 'Схемы поддерживают до 100 полок в одном проекте. Спецификация деталей доступна.' }, panels: [] };
    const side = base.parts.find(p => p.name === 'Боковина');
    const divider = base.parts.find(p => p.name === 'Вертикальная перегородка');
    function number(key, min, max) {
      const raw = String(values[key] ?? '').trim(), n = Number(raw.replace(',', '.'));
      if (!/^\d+(?:[.,]\d+)?$/.test(raw) || !Number.isFinite(n) || n < min || n > max) { errors[key] = `По инструкции крепежа укажите значение от ${min} до ${max} мм.`; return 0; }
      return n;
    }
    const edge = number('drillOffset', 1, 1000);
    const useConfirmat = methodsUsed.some(m => m.includes('confirmat'));
    const useDowel = methodsUsed.some(m => m.includes('dowel'));
    const useCam = methodsUsed.some(m => m.includes('eccentric'));
    const useSupports = shelfMethod === 'supports' && base.joinery.shelfCount > 0;
    const p = {};
    if (methodsUsed.includes('screw')) { p.screwThrough = number('screwThrough', 1, t - 1); p.screwPilot = number('screwPilot', 1, t - 1); p.screwDepth = number('screwDepth', 1, 100); }
    if (useConfirmat) {
      p.through = number('throughDiameter', 1, t - 1);
      p.pilot = number('pilotDiameter', 1, t - 1);
      p.pilotDepth = number('pilotDepth', 1, 100);
    }
    if (useDowel) {
      p.dowelDiameter = number('dowelDiameter', 1, t - 1);
      p.dowelFaceDepth = number('dowelFaceDepth', 1, t - 1);
      p.dowelEndDepth = number('dowelEndDepth', 1, 100);
      if (p.dowelFaceDepth + p.dowelEndDepth < 30) errors.dowelEndDepth = 'Суммарная глубина отверстий для шканта 8 × 30 должна быть не меньше 30 мм.';
      if (methodsUsed.some(m => m.endsWith('_dowel'))) p.dowelOffset = number('dowelOffset', 1, 1000);
    }
    if (useCam) {
      p.camDiameter = number('camDiameter', 1, 40);
      p.camDepth = number('camDepth', 1, t - 1);
      p.camEdge = number('camEdge', 1, 100);
      p.camEntryDiameter = number('camEntryDiameter', 1, t - 1);
      p.camPinDiameter = number('camPinDiameter', 1, t - 1);
      p.camPinDepth = number('camPinDepth', 1, t - 1);
      if (p.camDepth && p.camEntryDiameter && p.camDepth < t / 2 + p.camEntryDiameter / 2) errors.camDepth = 'Глубина чашки должна вмещать торцевой вход штока на оси половины толщины.';
    }
    if (useSupports) { p.supportDiameter = number('supportDiameter', 1, t - 1); p.supportDepth = number('supportDepth', 1, t - 1); }
    if (methodsUsed.every(m => m === 'none')) errors.drilling = 'Выберите крепление корпуса или полок.';
    if (Object.keys(errors).length) return { errors, panels: [] };
    const make = (name, length, depth) => { const panel = { name, length, depth, thickness: t, holes: [] }; panels.push(panel); return panel; };
    const left = make('Боковина левая', h, side.depth), right = make('Боковина правая', h, side.depth);
    const upper = make('Верх', top.length, top.depth), lower = make('Низ', top.length, top.depth);
    const dividers = base.layout.slice(1).map((_, i) => make(`Перегородка ${i + 1}`, ih, divider.depth));
    function positions(depth, n, offset) {
      if (n === 1) return [depth / 2];
      if (2 * offset >= depth) { errors.drillOffset = 'Отступы отверстий не помещаются по глубине детали.'; return []; }
      return Array.from({ length: n }, (_, i) => offset + i * (depth - 2 * offset) / (n - 1));
    }
    function hole(panel, x, y, diameter, depth, surface, purpose) {
      const r = diameter / 2;
      if (surface === 'Плоскость A' || surface === 'Плоскость B') {
        if (x - r < 0 || x + r > panel.length || y - r < 0 || y + r > panel.depth) errors.geometry = `Отверстие выходит за край: ${panel.name}.`;
        if (depth > t) errors.geometry = `Глубина отверстия больше толщины детали: ${panel.name}.`;
      } else if (y - r < 0 || y + r > panel.depth || diameter >= t || depth >= panel.length) errors.geometry = `Торцевое отверстие не помещается: ${panel.name}.`;
      const record = { x, y, diameter, depth, surface, purpose, z: surface.startsWith('Торец') ? t / 2 : null };
      for (const old of panel.holes) {
        if ((old.surface === surface || (old.surface.startsWith('Плоскость') && surface.startsWith('Плоскость') && old.depth + depth >= t)) && Math.hypot(old.x - x, old.y - y) < (old.diameter + diameter) / 2 - .001) errors.collision = `Пересекаются отверстия: ${panel.name}. Измените уровни полок, отступы или крепёж.`;
      }
      panel.holes.push(record);
    }
    // A receiver plane meets the end of a perpendicular panel. Depth-row coordinates share a front datum.
    function joint(receiver, receiverX, face, endPanel, end, method, points, frontShift = 0) {
      const rows = positions(endPanel.depth, points, edge);
      const endX = end === 'начало' ? 0 : endPanel.length;
      const endName = end === 'начало' ? 'Торец X=0' : 'Торец X=L';
      rows.forEach(y => {
        if (method === 'screw') {
          hole(receiver, receiverX, y + frontShift, p.screwThrough, t, face, 'Сквозное под шуруп');
          hole(endPanel, endX, y, p.screwPilot, p.screwDepth, endName, 'Под резьбу шурупа');
        }
        if (method.includes('confirmat')) {
          hole(receiver, receiverX, y + frontShift, p.through, t, face, 'Сквозное под конфирмат');
          hole(endPanel, endX, y, p.pilot, p.pilotDepth, endName, 'Под резьбу конфирмата');
        }
        if (method.includes('eccentric')) {
          hole(receiver, receiverX, y + frontShift, p.camPinDiameter, p.camPinDepth, face, 'Под шток эксцентрика');
          hole(endPanel, endX, y, p.camEntryDiameter, p.camEdge, endName, 'Вход штока');
          hole(endPanel, end === 'начало' ? p.camEdge : endPanel.length - p.camEdge, y, p.camDiameter, p.camDepth, 'Плоскость A', 'Под эксцентрик');
        }
      });
      if (method.includes('dowel')) {
        const offset = method.endsWith('_dowel') ? p.dowelOffset : edge;
        positions(endPanel.depth, points, offset).forEach(y => {
          hole(receiver, receiverX, y + frontShift, p.dowelDiameter, p.dowelFaceDepth, method.includes('confirmat') ? (face === 'Плоскость A' ? 'Плоскость B' : 'Плоскость A') : face, 'Под шкант');
          hole(endPanel, endX, y, p.dowelDiameter, p.dowelEndDepth, endName, 'Под шкант');
        });
      }
    }
    if (bodyMethod !== 'none') {
      const sideFace = (bodyMethod.includes('confirmat') || bodyMethod === 'screw') ? 'Плоскость B' : 'Плоскость A';
      joint(left, t / 2, sideFace, upper, 'начало', bodyMethod, bodyPoints);
      joint(right, t / 2, sideFace, upper, 'конец', bodyMethod, bodyPoints);
      joint(left, h - t / 2, sideFace, lower, 'начало', bodyMethod, bodyPoints);
      joint(right, h - t / 2, sideFace, lower, 'конец', bodyMethod, bodyPoints);
      let x = 0;
      dividers.forEach((panel, i) => {
        x += base.layout[i].width;
        const center = x + t / 2;
        const horizontalFace = (bodyMethod.includes('confirmat') || bodyMethod === 'screw') ? 'Плоскость B' : 'Плоскость A';
        joint(upper, center, horizontalFace, panel, 'начало', bodyMethod, bodyPoints);
        joint(lower, center, horizontalFace, panel, 'конец', bodyMethod, bodyPoints);
        x += t;
      });
    }
    if (shelfMethod !== 'none') {
      base.layout.forEach((section, i) => {
        if (!section.shelves) return;
        const shelf = base.parts.find(part => part.name === `Секция ${i + 1} · полка`);
        const freeHeight = ih - section.drawerStack - (section.drawerStack ? 2 * Number(values.frontGap ?? 2) : 0);
        const custom = String(values.sections[i].shelfLevels ?? '').trim();
        // Levels are distances from the top of the clear opening to each shelf's top surface.
        const levels = custom ? custom.split(';').map(s => Number(s.trim().replace(',', '.'))) : Array.from({ length: section.shelves }, (_, n) => (n + 1) * (freeHeight - section.shelves * t) / (section.shelves + 1) + n * t);
        if (levels.length !== section.shelves || levels.some(n => !Number.isFinite(n) || n <= 0 || n + t >= freeHeight) || levels.some((n, j) => j > 0 && n <= levels[j - 1] + t)) { errors[`shelfLevels${i}`] = 'Укажите возрастающие уровни верхней поверхности полок в мм через ;, внутри свободной высоты над ящиками.'; return; }
        const leftReceiver = i === 0 ? left : dividers[i - 1], rightReceiver = i === base.layout.length - 1 ? right : dividers[i];
        const offsetX = i === 0 ? t : 0, rightOffsetX = i === base.layout.length - 1 ? t : 0;
        const shelfShift = side.depth - (values.back === 'inset' ? Number(values.backThickness ?? 3) : 0) - shelf.depth;
        if (shelfMethod !== 'supports' && Number(values.shelfGap ?? 1) !== 0) errors.shelfGap = 'Для схемы неподвижных полок установите боковой зазор полки 0 мм.';
        levels.forEach((level, n) => {
          if (shelfMethod === 'supports') {
            positions(shelf.depth, shelfPoints, edge).forEach(y => {
              hole(leftReceiver, offsetX + level + t + p.supportDiameter / 2, y + shelfShift, p.supportDiameter, p.supportDepth, 'Плоскость A', `Полкодержатель, секция ${i + 1}, полка ${n + 1}`);
              hole(rightReceiver, rightOffsetX + level + t + p.supportDiameter / 2, y + shelfShift, p.supportDiameter, p.supportDepth, i === base.layout.length - 1 ? 'Плоскость A' : 'Плоскость B', `Полкодержатель, секция ${i + 1}, полка ${n + 1}`);
            });
          } else {
            const panel = make(`Секция ${i + 1} · полка ${n + 1}`, shelf.length, shelf.depth);
            const faceLeft = (shelfMethod.includes('confirmat') || shelfMethod === 'screw') ? (i === 0 ? 'Плоскость B' : 'Плоскость B') : 'Плоскость A';
            const faceRight = (shelfMethod.includes('confirmat') || shelfMethod === 'screw') ? (i === base.layout.length - 1 ? 'Плоскость B' : 'Плоскость A') : (i === base.layout.length - 1 ? 'Плоскость A' : 'Плоскость B');
            joint(leftReceiver, offsetX + level + t / 2, faceLeft, panel, 'начало', shelfMethod, shelfPoints, shelfShift);
            joint(rightReceiver, rightOffsetX + level + t / 2, faceRight, panel, 'конец', shelfMethod, shelfPoints, shelfShift);
          }
        });
      });
    }
    return { errors, panels: Object.keys(errors).length ? [] : panels.filter(p => p.holes.length) };
  }
  const api = { methods, apply, drill };
  root.MebelJoinery = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
