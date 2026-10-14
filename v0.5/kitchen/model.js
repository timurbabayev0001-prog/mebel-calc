(function (root) {
  'use strict';
  const defaults = () => ({ version: 5, layout: 'straight', room: { width: 3800, depth: 3000, height: 2700 }, lowerHeight: 720, upperHeight: 720, lowerDepth: 560, upperDepth: 320, legHeight: 100, backsplashHeight: 600, backsplashPattern: 'tile', thickness: 18, frontThickness: 18, topThickness: 40, frontGap: 2, shelfGap: 1, shelfInset: 20, guideGap: 12.5, guideLength: 450, backThickness: 3, railWidth: 80, cornerClearance: 60, overhang: 40, hingesPerDoor: 2, bodyPoints: 2, bodyFixing: 'confirmat', handles: 'bar', handleColor: 'black', toeKick: true, light: { mode: 'day', intensity: 1, led: true, ledColor: 'warm', ceiling: false }, decors: { body: { id: 'white' }, lower: { id: 'cashmere' }, upper: { id: 'white' }, top: { id: 'oak' }, backsplash: { id: 'white' }, wall: { id: 'cashmere' }, floor: { id: 'oak' }, ceiling: { id: 'white' } }, modules: [
    { id: 'n1', level: 'lower', run: 'A', name: 'Мойка', type: 'sink', width: 600, shelves: 0, doors: 2, drawers: 3, legs: 4 },
    { id: 'n2', level: 'lower', run: 'A', name: 'Ящики', type: 'drawers', width: 600, shelves: 0, doors: 1, drawers: 3, legs: 4 },
    { id: 'n3', level: 'lower', run: 'A', name: 'Духовка', type: 'oven', width: 600, shelves: 0, doors: 1, drawers: 3, legs: 4, nicheHeight: 600 },
    { id: 'n4', level: 'lower', run: 'A', name: 'Шкаф', type: 'doors', width: 600, shelves: 1, doors: 1, drawers: 3, legs: 4 },
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'u' + (i + 1), level: 'upper', run: 'A', name: 'Верхний шкаф', type: 'doors', width: 600, shelves: 1, doors: 1, drawers: 3, legs: 0 }))
  ], tops: [{ id: 't1', run: 'A', auto: true, start: 0, length: 2400, depth: 600, thickness: 40 }], hardware: [] });
  function calculate(project) {
    const errors = [], warnings = [], parts = [], hardware = [], modules = [], tops = [];
    const fail = message => errors.push(message);
    function n(value, label, min, max, integer = false) {
      const text = String(value ?? '').trim(), v = Number(text.replace(',', '.'));
      if (!/^\d+(?:[.,]\d+)?$/.test(text) || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) { fail(`${label}: введите ${integer ? 'целое ' : ''}число от ${min} до ${max}.`); return min; }
      return v;
    }
    if (!project || typeof project !== 'object') return { errors: ['Неверный формат кухни.'], parts: [], hardware: [], modules: [], tops: [], warnings };
    const p = { ...defaults(), ...project, room: { ...defaults().room, ...project.room } };
    if (!['straight', 'corner'].includes(p.layout)) fail('Выберите прямую или угловую кухню.');
    const room = { width: n(p.room.width, 'Ширина помещения', 500, 12000), depth: n(p.room.depth, 'Глубина помещения', 500, 12000), height: n(p.room.height, 'Высота помещения', 1000, 6000) };
    const t = n(p.thickness, 'Толщина корпуса', 16, 18, true); if (![16, 18].includes(t)) fail('ЛДСП корпуса: 16 или 18 мм.');
    const ft = n(p.frontThickness, 'Толщина фасада', 16, 22);
    const lh = n(p.lowerHeight, 'Высота нижнего корпуса', 100, 1500), uh = n(p.upperHeight, 'Высота верхнего корпуса', 100, 2000);
    const ld = n(p.lowerDepth, 'Глубина нижнего корпуса', 150, 1200), ud = n(p.upperDepth, 'Глубина верхнего корпуса', 100, 800);
    const leg = n(p.legHeight, 'Высота ножек', 0, 300), apron = n(p.backsplashHeight, 'Высота фартука', 100, 1500);
    const g = n(p.frontGap, 'Зазор фасадов', 0, 10), sg = n(p.shelfGap, 'Зазор полки', 0, 10), si = n(p.shelfInset, 'Отступ полки', 0, 200);
    const guideGap = n(p.guideGap, 'Зазор направляющих', 0, 50), guideLength = n(p.guideLength, 'Длина направляющих', 100, 1000);
    const backT = n(p.backThickness, 'Толщина ХДФ', 1, 10), rail = n(p.railWidth, 'Ширина верхних планок', 30, 200);
    const clearance = n(p.cornerClearance, 'Зазор в углу', 0, 300), overhang = n(p.overhang, 'Свес столешницы спереди', 0, 200);
    const hinges = n(p.hingesPerDoor, 'Петель на дверь', 1, 6, true), points = n(p.bodyPoints, 'Крепежей на соединение', 1, 10, true);
    const topT = n(p.topThickness, 'Уровень/толщина столешницы', 1, 100);
    if (!['none', 'confirmat', 'screw', 'dowel', 'eccentric', 'confirmat_dowel', 'eccentric_dowel'].includes(p.bodyFixing)) fail('Некорректный способ крепления.');
    if (!['bar', 'knob', 'profile', 'none'].includes(p.handles)) fail('Выберите ручки.');
    if (!['black', 'chrome', 'gold'].includes(p.handleColor)) fail('Выберите цвет ручек.');
    if (!p.light || !['day', 'evening', 'studio'].includes(p.light.mode) || !['warm', 'neutral', 'cool'].includes(p.light.ledColor)) fail('Выберите режим света и цвет подсветки.');
    n(p.light?.intensity, 'Яркость света', .3, 2);
    const decor = role => root.MebelCatalog.decor(p.decors?.[role]);
    const roomDecors = Object.fromEntries(['body', 'lower', 'upper', 'top', 'backsplash', 'wall', 'floor', 'ceiling'].map(role => [role, decor(role)]));
    const list = Array.isArray(p.modules) ? p.modules : [];
    if (!Array.isArray(p.modules) || list.length > 48) fail('Допускается до 48 модулей.');
    const seen = new Set();
    const valid = list.filter(m => {
      if (!m || typeof m !== 'object' || !['lower', 'upper'].includes(m.level) || !['A', 'B'].includes(m.run) || typeof m.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(m.id) || seen.has(m.id)) { fail('Некорректные или повторяющиеся данные модулей.'); return false; }
      seen.add(m.id); return p.layout === 'corner' || m.run === 'A';
    });
    if (!valid.length) fail('Добавьте хотя бы один модуль.');
    const groups = {};
    for (const level of ['lower', 'upper']) for (const run of ['A', 'B']) {
      const group = valid.filter(m => m.level === level && m.run === run);
      if (group.length > 12) fail('На каждой стене допускается до 12 верхних и 12 нижних модулей.');
      groups[level + run] = group;
    }
    function add(module, name, length, depth, thickness, quantity, material, role, edgeLong = 0, edgeShort = 0) {
      if (!quantity) return;
      if (!(length > 0 && depth > 0 && thickness > 0)) { fail(`${module}: деталь «${name}» имеет неположительный размер.`); return; }
      parts.push({ module, name, length, depth, thickness, quantity, material, decor: material === 'ХДФ' ? 'Без выбранного декора' : roomDecors[role].name, role, edgeLong, edgeShort });
    }
    function fitting(module, name, quantity, unit = 'шт.', note = '') { if (quantity > 0) hardware.push({ module, name, quantity, unit, note, article: '' }); }
    function bodyFix(module, joints) {
      const qty = joints * points;
      if (p.bodyFixing.includes('confirmat')) fitting(module, 'Конфирмат 7 × 50', qty);
      if (p.bodyFixing === 'screw') fitting(module, 'Шуруп 3,5 × 50', qty);
      if (p.bodyFixing.includes('dowel')) fitting(module, 'Шкант 8 × 30', qty);
      if (p.bodyFixing.includes('eccentric')) fitting(module, 'Эксцентрик + шток', qty, 'компл.');
    }
    let doorCount = 0, drawerCount = 0, handleCount = 0;
    for (const level of ['lower', 'upper']) {
      const H = level === 'lower' ? lh : uh, D = level === 'lower' ? ld : ud;
      const bStart = p.layout === 'corner' && groups[level + 'A'].length ? D + clearance : 0;
      for (const run of ['A', 'B']) {
        const group = groups[level + run];
        if (p.layout === 'corner' && run === 'A' && group.length && groups[level + 'B'].length && group[0].type !== 'blind') fail(`${level === 'lower' ? 'Нижний' : 'Верхний'} угол: первым на стене A должен быть глухой угловой модуль.`);
        let cursor = run === 'A' ? 0 : bStart;
        group.forEach((m, index) => {
          const label = `${level === 'lower' ? 'Н' : 'В'}${run}${index + 1}`, name = String(m.name || 'Модуль').trim().slice(0, 80);
          const title = `${label} · ${name}`;
          const W = n(m.width, `${title}, ширина`, 100, 2000, true), iw = W - 2 * t, ih = H - 2 * t;
          const types = level === 'lower' ? ['doors', 'drawers', 'open', 'sink', 'oven', 'dishwasher', 'blind'] : ['doors', 'open', 'blind'];
          if (!types.includes(m.type)) fail(`${title}: выберите доступный тип модуля.`);
          if (m.type === 'blind' && (p.layout !== 'corner' || run !== 'A' || index !== 0 || !groups[level + 'B'].length)) fail(`${title}: угловой модуль нужен только первым на стене A, при наличии стены B.`);
          const countDoors = ['doors', 'sink'].includes(m.type) ? n(m.doors ?? 1, `${title}, дверей`, 1, 4, true) : m.type === 'blind' || m.type === 'dishwasher' ? 1 : 0;
          const countDrawers = m.type === 'drawers' ? n(m.drawers ?? 3, `${title}, ящиков`, 1, 8, true) : 0;
          const shelves = ['doors', 'open', 'blind'].includes(m.type) ? n(m.shelves ?? 1, `${title}, полок`, 0, 10, true) : 0;
          const legs = level === 'lower' && m.type !== 'dishwasher' ? n(m.legs ?? 4, `${title}, ножек`, 0, 12, true) : 0;
          if (H <= 2 * t || iw <= 0 || D <= backT + si || shelves * t >= ih) fail(`${title}: детали не помещаются внутри корпуса.`);
          const role = level, bodyDepth = D - (['sink', 'oven', 'dishwasher'].includes(m.type) ? 0 : backT);
          const solid = m.type !== 'dishwasher';
          if (solid) {
            add(title, 'Боковина', H, bodyDepth, t, 2, 'ЛДСП', 'body', 1);
            add(title, 'Низ', iw, bodyDepth, t, 1, 'ЛДСП', 'body', 1);
            if (['sink', 'oven'].includes(m.type)) { if (2 * rail >= D) fail(`${title}: верхние планки слишком широкие.`); add(title, 'Верхняя стяжная планка', iw, rail, t, 2, 'ЛДСП', 'body', 1); }
            else add(title, 'Верх', iw, bodyDepth, t, 1, 'ЛДСП', 'body', 1);
            if (!['sink', 'oven'].includes(m.type)) add(title, 'Задняя стенка', H - 2, W - 2, backT, 1, 'ХДФ', 'body');
            add(title, 'Полка', iw - 2 * sg, bodyDepth - si, t, shelves, 'ЛДСП', 'body', 1);
            bodyFix(title, ['sink', 'oven'].includes(m.type) ? 6 : 4);
            fitting(title, 'Полкодержатель', shelves * 4);
          }
          const frontH = H - 2 * g;
          let blindWidth = 0, frontW = W - 2 * g, nicheHeight = 0;
          if (m.type === 'blind') {
            blindWidth = D + clearance;
            frontW = W - blindWidth - 2 * g;
            if (frontW < 200) fail(`${title}: после глухой зоны и зазора дверь должна быть не уже 200 мм. Увеличьте ширину углового модуля.`);
            add(title, 'Глухая лицевая панель', frontH, D - 2 * g, ft, 1, 'ЛДСП · фасад', role, 2, 2);
            if (clearance > 0) add(title, 'Угловой добор', frontH, clearance - 2 * g, ft, 1, 'ЛДСП · фасад', role, 2, 2);
          }
          if (countDoors) {
            add(title, 'Фасад двери', frontH, (frontW - (countDoors - 1) * g) / countDoors, ft, countDoors, 'ЛДСП · фасад', role, 2, 2);
            if (m.type !== 'dishwasher') fitting(title, 'Петля мебельная', countDoors * hinges);
            doorCount += countDoors; handleCount += countDoors;
          }
          if (countDrawers) {
            const fH = (frontH - (countDrawers - 1) * g) / countDrawers;
            const boxHeight = Math.min(120, fH - backT - 20), boxW = iw - 2 * guideGap;
            if (countDrawers * (boxHeight + backT) + (countDrawers - 1) * 10 > ih || boxHeight < 30 || boxW <= 2 * t || guideLength + 10 > bodyDepth) fail(`${title}: ящик не помещается по высоте, ширине или глубине.`);
            add(title, 'Фасад ящика', fH, W - 2 * g, ft, countDrawers, 'ЛДСП · фасад', role, 2, 2);
            add(title, 'Боковина ящика', guideLength, boxHeight, t, 2 * countDrawers, 'ЛДСП', 'body');
            add(title, 'Передняя стенка ящика', boxW - 2 * t, boxHeight, t, countDrawers, 'ЛДСП', 'body');
            add(title, 'Задняя стенка ящика', boxW - 2 * t, boxHeight, t, countDrawers, 'ЛДСП', 'body');
            add(title, 'Накладное дно ящика', boxW, guideLength, backT, countDrawers, 'ХДФ', 'body');
            fitting(title, 'Боковые направляющие', countDrawers, 'пар', `Длина ${guideLength} мм, зазор ${guideGap} мм с каждой стороны`);
            drawerCount += countDrawers; handleCount += countDrawers;
          }
          if (m.type === 'oven') {
            nicheHeight = n(m.nicheHeight ?? 600, `${title}, высота ниши духовки`, 100, H - 2 * t);
            add(title, 'Опора духовки', iw, bodyDepth, t, 1, 'ЛДСП', 'body', 1);
            add(title, 'Нижняя лицевая планка', H - nicheHeight - t - 2 * g, W - 2 * g, ft, 1, 'ЛДСП · фасад', role, 2, 2);
            bodyFix(title, 2);
            warnings.push(`${title}: ниша ${iw} × ${nicheHeight} × ${D} мм. Монтажные зазоры, вентиляция и вырезы проверяются по инструкции духовки.`);
          }
          fitting(title, `Регулируемая ножка · ${leg} мм`, legs);
          if (level === 'upper') fitting(title, 'Регулируемый навес', 2, 'шт.', 'Количество и несущую способность согласуйте с выбранной системой и стеной');
          modules.push({ ...m, label, title, width: W, height: H, depth: D, y: level === 'lower' ? leg : leg + lh + topT + apron, x: run === 'A' ? cursor : 0, z: run === 'A' ? 0 : cursor, fronts: countDoors, drawers: countDrawers, shelves, blindWidth, nicheHeight });
          cursor += W;
        });
        if (cursor > (run === 'A' ? room.width : room.depth)) fail(`Модули ${level === 'lower' ? 'снизу' : 'сверху'} на стене ${run} не помещаются в помещении.`);
        if (level === 'upper' && group.length) fitting(`Стена ${run}`, 'Монтажная рейка навесов', group.reduce((s, m) => s + Number(m.width), 0) / 1000, 'м', 'Длина без запаса; крепёж к стене задаётся отдельно');
        if (level === 'lower' && group.length && p.toeKick && leg > 0) add(`Стена ${run}`, 'Цокольная планка', group.reduce((s, m) => s + Number(m.width), 0), leg, t, 1, 'ЛДСП', 'lower', 1);
      }
    }
    if (ld > room.depth || ud > room.depth || (p.layout === 'corner' && (ld > room.width || ud > room.width))) fail('Глубина модулей больше размера помещения.');
    if (modules.some(m => m.y + m.height > room.height)) fail('Верхние модули не помещаются по высоте. Измените высоту помещения, фартука или шкафов.');
    const lowerA = modules.filter(m => m.level === 'lower' && m.run === 'A'), lowerB = modules.filter(m => m.level === 'lower' && m.run === 'B');
    const topList = Array.isArray(p.tops) ? p.tops : [];
    if (!Array.isArray(p.tops) || topList.length > 6) fail('Допускается до 6 частей столешницы.');
    topList.forEach((item, i) => {
      if (!item || !['A', 'B'].includes(item.run) || (p.layout === 'straight' && item.run === 'B')) { fail(`Столешница ${i + 1}: выберите доступную стену.`); return; }
      const row = item.run === 'A' ? lowerA : lowerB;
      if (!row.length) { fail(`Столешница ${i + 1}: на этой стене нет нижних модулей.`); return; }
      const depth = item.auto ? ld + overhang : n(item.depth, `Столешница ${i + 1}, глубина`, 100, 2000);
      const start = item.auto ? (item.run === 'A' || !lowerA.length ? 0 : ld + overhang) : n(item.start, `Столешница ${i + 1}, начало от угла`, 0, 12000);
      const end = Math.max(...row.map(m => (item.run === 'A' ? m.x : m.z) + m.width));
      const length = item.auto ? end - start : n(item.length, `Столешница ${i + 1}, длина`, 1, 12000);
      const thickness = n(item.thickness ?? topT, `Столешница ${i + 1}, толщина`, 1, 100);
      if (thickness !== topT) fail(`Столешница ${i + 1}: для общего уровня задайте толщину ${topT} мм или измените общую толщину.`);
      const rect = { x: item.run === 'A' ? start : 0, z: item.run === 'A' ? 0 : start, width: item.run === 'A' ? length : depth, depth: item.run === 'A' ? depth : length };
      if (length <= 0 || rect.x + rect.width > room.width || rect.z + rect.depth > room.depth) fail(`Столешница ${i + 1} выходит за помещение или имеет неположительную длину.`);
      if (tops.some(t => Math.min(t.x + t.width, rect.x + rect.width) - Math.max(t.x, rect.x) > .01 && Math.min(t.z + t.depth, rect.z + rect.depth) - Math.max(t.z, rect.z) > .01)) fail(`Столешница ${i + 1} перекрывает другую часть. Скорректируйте начало и длину.`);
      tops.push({ ...rect, y: leg + lh, thickness, run: item.run, length, boardDepth: depth, name: `Столешница ${i + 1}` });
      add('Кухня', `Столешница ${i + 1}`, length, depth, thickness, 1, 'Столешница', 'top');
    });
    for (const m of modules.filter(m => m.level === 'lower')) {
      const rect = { x: m.x, z: m.z, width: m.run === 'A' ? m.width : m.depth, depth: m.run === 'A' ? m.depth : m.width };
      const covered = tops.reduce((a, t) => a + Math.max(0, Math.min(rect.x + rect.width, t.x + t.width) - Math.max(rect.x, t.x)) * Math.max(0, Math.min(rect.z + rect.depth, t.z + t.depth) - Math.max(rect.z, t.z)), 0);
      if (tops.length && covered + .01 < rect.width * rect.depth) warnings.push(`${m.title}: столешница не покрывает весь корпус. Проверьте начало, длину и глубину частей.`);
    }
    if (p.light?.led) {
      const length = modules.filter(m => m.level === 'upper').reduce((s, m) => s + Math.max(0, m.width - 30), 0) / 1000;
      fitting('Подсветка', 'Светодиодная лента', length, 'м', `Цвет: ${{warm:'тёплый',neutral:'нейтральный',cool:'холодный'}[p.light.ledColor]}; блок питания и проводку добавьте по мощности ленты`);
      fitting('Подсветка', 'Профиль с рассеивателем', length, 'м', 'Отрезки по ширине верхних модулей минус 30 мм; без запаса');
    }
    if (modules.some(m => m.level === 'lower') && !tops.length) warnings.push('Столешница не добавлена. Укажите количество частей и размеры.');
    if (p.handles !== 'none') fitting('Кухня', p.handles === 'knob' ? 'Ручка-кнопка' : p.handles === 'profile' ? 'Профиль-ручка' : 'Ручка-скоба', handleCount, 'шт.', p.handles === 'profile' ? 'Отдельный профиль на фасад; длину и монтаж задавайте по модели, это не система Gola' : `Цвет: ${{black:'чёрный',chrome:'хром',gold:'латунь'}[p.handleColor]}`);
    const extras = Array.isArray(p.hardware) ? p.hardware : [];
    if (!Array.isArray(p.hardware) || extras.length > 50) fail('Допускается до 50 дополнительных позиций фурнитуры.');
    extras.forEach((item, i) => {
      if (!item || typeof item !== 'object' || !String(item.name ?? '').trim()) { fail(`Фурнитура ${i + 1}: укажите название.`); return; }
      const quantity = n(item.quantity, `Фурнитура ${i + 1}, количество`, .001, 100000);
      const unit = ['шт.', 'пар', 'компл.', 'м'].includes(item.unit) ? item.unit : 'шт.';
      hardware.push({ module: 'Дополнительно', name: String(item.name).slice(0, 100), article: String(item.article ?? '').slice(0, 100), quantity, unit, note: String(item.note ?? '').slice(0, 300) });
    });
    const materials = new Map(); let area = 0, edge = 0, count = 0;
    parts.forEach(part => { const a = part.length * part.depth * part.quantity / 1e6; area += a; count += part.quantity; edge += (part.length * part.edgeLong + part.depth * part.edgeShort) * part.quantity / 1000; const key = `${part.material} · ${part.thickness} мм · ${part.material === 'ХДФ' ? 'без декора' : part.decor}`; materials.set(key, (materials.get(key) || 0) + a); });
    warnings.push('Спецификация — по выбранной конструкции. Раскрой по листам, отверстия, вырезы мойки/техники, стены, инженерные коммуникации и монтажные допуски требуют отдельного проекта. Цвета и свет в 3D условные.');
    return { errors, warnings: [...new Set(warnings)], parts: errors.length ? [] : parts, hardware: errors.length ? [] : hardware, modules: errors.length ? [] : modules, tops: errors.length ? [] : tops, room, decors: roomDecors, parameters: { lh, uh, ld, ud, t, ft, leg, apron, g, topT }, totals: errors.length ? null : { count, area, edge, modules: modules.length, doors: doorCount, drawers: drawerCount, materials: Array.from(materials, ([name, area]) => ({ name, area })) } };
  }
  function csv(result) {
    const rows = [['Раздел', 'Модуль', 'Название', 'Длина, мм', 'Ширина, мм', 'Толщина, мм', 'Материал / артикул', 'Декор', 'Количество', 'Единица', 'Кромка Д/Ш', 'Примечание']];
    result.parts.forEach(p => rows.push(['Деталь', p.module, p.name, p.length, p.depth, p.thickness, p.material, p.decor, p.quantity, 'шт.', `${p.edgeLong}/${p.edgeShort}`, '']));
    result.hardware.forEach(p => rows.push(['Фурнитура', p.module, p.name, '', '', '', p.article, '', p.quantity, p.unit, '', p.note]));
    const escape = v => '"' + String(typeof v === 'string' && /^[=+@\-\t\r]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
    return '\ufeff' + rows.map(r => r.map(escape).join(';')).join('\r\n');
  }
  const api = { defaults, calculate, csv };
  root.KitchenCalc = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
