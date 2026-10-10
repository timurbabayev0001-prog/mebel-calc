const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateProject, toCSV } = require('../calculator.js');
const base = { width: 800, height: 720, depth: 500, thickness: 16 };
const part = (result, text) => result.parts.find(p => p.name.includes(text));
const valid = result => assert.deepEqual(result.errors, {});
test('Базовый корпус сохраняет размеры версии 0.1', () => {
  const result = calculateProject(base); valid(result);
  assert.equal(result.totals.quantity, 4);
  assert.equal(part(result, 'Боковина').length, 720);
  assert.equal(part(result, 'Верх').length, 768);
  assert.equal(part(result, 'Низ').depth, 500);
  assert.equal(result.totals.area, 1.488);
});
test('Две секции с полками и перегородкой', () => {
  const result = calculateProject({ ...base, sections: [{ shelves: 2 }, { shelves: 1 }] }); valid(result);
  assert.equal(result.layout[0].width, 376);
  assert.equal(part(result, 'перегородка').length, 688);
  assert.equal(part(result, 'полка').length, 374);
  assert.equal(part(result, 'полка').depth, 480);
  assert.equal(result.totals.quantity, 8);
});
test('Накладная стенка входит в наружную глубину; вкладная уменьшает полезную глубину', () => {
  const overlay = calculateProject({ ...base, back: 'overlay', sections: [{ shelves: 1 }] }); valid(overlay);
  assert.equal(part(overlay, 'Боковина').depth, 497);
  assert.equal(part(overlay, 'стенка').length, 718);
  assert.equal(part(overlay, 'стенка').depth, 798);
  const inset = calculateProject({ ...base, back: 'inset', sections: [{ shelves: 1 }] }); valid(inset);
  assert.equal(part(inset, 'Боковина').depth, 500);
  assert.equal(part(inset, 'стенка').length, 686);
  assert.equal(part(inset, 'стенка').depth, 766);
  assert.equal(part(inset, 'полка').depth, 477);
});
test('Накладные двери: один корпус, две двери с промежуточным зазором', () => {
  const result = calculateProject({ ...base, sections: [{ front: 'doors', doors: 2 }] }); valid(result);
  assert.equal(part(result, 'дверь').length, 716);
  assert.equal(part(result, 'дверь').depth, 397);
  assert.equal(part(result, 'дверь').quantity, 2);
});
test('Фасады соседних секций делят перегородку пополам', () => {
  const result = calculateProject({ ...base, sections: [{ front: 'doors' }, { front: 'doors' }] }); valid(result);
  const fronts = result.parts.filter(p => p.name.includes('дверь'));
  assert.deepEqual(fronts.map(p => p.depth), [396, 396]);
});
test('Вкладной фасад уменьшает ширину, высоту и глубину полок', () => {
  const result = calculateProject({ ...base, frontMode: 'inset', sections: [{ front: 'doors', shelves: 1 }] }); valid(result);
  assert.equal(part(result, 'дверь').length, 684);
  assert.equal(part(result, 'дверь').depth, 764);
  assert.equal(part(result, 'полка').depth, 462);
});
test('Три ящика: фасады, четыре стенки и дно каждого короба', () => {
  const result = calculateProject({ ...base, sections: [{ front: 'drawers', drawers: 3 }] }); valid(result);
  assert.equal(part(result, 'фасад ящика').length, 180);
  assert.equal(part(result, 'боковина ящика').quantity, 6);
  assert.equal(part(result, 'передняя стенка ящика').length, 711);
  assert.equal(part(result, 'дно ящика').length, 743);
  assert.equal(part(result, 'дно ящика').depth, 400);
  assert.equal(result.totals.quantity, 22);
  assert.ok(result.warnings.length);
});
test('Ящики, не помещающиеся по глубине, ширине или высоте, отклоняются', () => {
  const drawers = { ...base, sections: [{ front: 'drawers', drawers: 3 }] };
  assert.ok(calculateProject({ ...drawers, guideLength: 500 }).errors.guideLength);
  assert.ok(calculateProject({ ...drawers, width: 80 }).errors.geometry);
  assert.ok(calculateProject({ ...drawers, height: 500 }).errors.drawers0);
  assert.ok(calculateProject({ ...drawers, boxHeight: 180 }).errors.boxHeight);
});
test('Полки помещаются над блоком ящиков', () => {
  const result = calculateProject({ ...base, sections: [{ front: 'drawers', drawers: 3, shelves: 1 }] }); valid(result);
  assert.ok(calculateProject({ ...base, sections: [{ front: 'drawers', drawers: 3, shelves: 10 }] }).errors.shelves0);
});
test('Индивидуальные ширины должны заполнить внутреннюю ширину', () => {
  const result = calculateProject({ ...base, sectionMode: 'custom', sections: [{ width: 300 }, { width: 452 }] }); valid(result);
  assert.deepEqual(result.layout.map(s => s.width), [300, 452]);
  assert.ok(calculateProject({ ...base, sectionMode: 'custom', sections: [{ width: 300 }, { width: 450 }] }).errors.sections);
});
test('Дополнительная деталь участвует в количествах, площади материала и кромке', () => {
  const result = calculateProject({ ...base, extras: [{ name: 'Цоколь', length: 800, depth: 100, thickness: 18, material: 'МДФ', quantity: 2, edgeLong: 2, edgeShort: 1 }] }); valid(result);
  assert.equal(result.totals.quantity, 6);
  assert.equal(result.totals.materials.find(m => m.name === 'МДФ · 18 мм').area, 0.16);
  assert.equal(result.totals.edge, 3.4);
});
test('Кромка передних торцов и всех сторон фасадов', () => {
  const result = calculateProject({ ...base, edge: 'on', sections: [{ front: 'doors', doors: 1 }] }); valid(result);
  assert.ok(Math.abs(result.totals.edge - (2 * .720 + 2 * .768 + 2 * (.716 + .796))) < 1e-9);
});
test('CSV экранирует текст и сохраняет точные размеры', () => {
  const result = calculateProject({ ...base, extras: [{ name: 'Планка "верх"; 1', length: 20.5, depth: 30, thickness: 16, material: 'ЛДСП', quantity: 1, edgeLong: 0, edgeShort: 0 }] }); valid(result);
  const csv = toCSV(result);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"Планка ""верх""; 1";"20.5"'));
});
test('Повреждённые данные и невозможная геометрия не возвращают спецификацию', () => {
  for (const values of [{ sections: [] }, { sections: [null] }, { shelfInset: 600, sections: [{ shelves: 1 }] }, { sections: [{ shelves: -1 }] }, { sections: [{ front: 'drawers', drawers: 0 }] }, { sections: [{ front: 'doors', doors: 0 }] }, { extras: [null] }, { width: 20000 }, { back: 'bad' }, { frontThickness: 20 }, { guideGap: 'abc', sections: [{ front: 'drawers' }] }]) {
    const result = calculateProject({ ...base, ...values });
    assert.ok(Object.keys(result.errors).length, JSON.stringify(values));
    assert.deepEqual(result.parts, []);
  }
});
test('ЛДСП корпуса, фасадов и ящиков объединяется по материалу и толщине', () => {
  const result = calculateProject({ ...base, sections: [{ front: 'drawers', drawers: 1 }] }); valid(result);
  assert.equal(result.totals.materials.filter(m => m.name === 'ЛДСП · 16 мм').length, 1);
  assert.equal(result.totals.materials.length, 2);
});
