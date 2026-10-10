const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateProject } = require('../calculator.js');
const { configure } = require('../catalog.js');
const { apply } = require('../joinery.js');
const base = { width: 800, height: 720, depth: 500, thickness: 16 };
const calc = extra => { const v = { ...base, ...extra }; return apply(v, configure(v, calculateProject(v))); };
const profile = { drilling: 'on', drillOffset: 50, throughDiameter: 7, pilotDiameter: 5, pilotDepth: 35 };
test('Корпус: восемь конфирматов 7×50 при двух на соединение', () => {
  const r = calc({ bodyFixing: 'confirmat' });
  assert.deepEqual(r.errors, {}); assert.equal(r.hardware[0].quantity, 8); assert.equal(r.joinery.bodyJoints, 4);
});
test('Перегородки и фиксированные полки добавляют крепёж', () => {
  const r = calc({ bodyFixing: 'screw', shelfFixing: 'confirmat', sections: [{ shelves: 2 }, { shelves: 1 }] });
  assert.equal(r.hardware[0].quantity, 12); assert.equal(r.hardware[1].quantity, 12);
  assert.equal(r.hardware[0].name, 'Шуруп 3,5 × 50 мм · корпус');
});
test('Комбинация эксцентриков со шкантами и съёмные полки', () => {
  const r = calc({ bodyFixing: 'eccentric_dowel', shelfFixing: 'supports', sections: [{ shelves: 2 }] });
  assert.deepEqual(r.hardware.map(p => [p.quantity, p.unit]), [[8, 'компл.'], [8, 'шт.'], [8, 'шт.']]);
});
test('Схема исходного корпуса: 16 отверстий на четырёх отдельных деталях', () => {
  const r = calc({ ...profile, bodyFixing: 'confirmat' });
  assert.deepEqual(r.drilling.errors, {}); assert.equal(r.drilling.panels.length, 4);
  const side = r.drilling.panels[0];
  assert.deepEqual(side.holes.map(h => [h.x, h.y, h.diameter, h.depth]), [[8, 50, 7, 16], [8, 450, 7, 16], [712, 50, 7, 16], [712, 450, 7, 16]]);
  const top = r.drilling.panels.find(p => p.name === 'Верх');
  assert.deepEqual(top.holes.map(h => [h.x, h.y, h.z, h.diameter]), [[0, 50, 8, 5], [0, 450, 8, 5], [768, 50, 8, 5], [768, 450, 8, 5]]);
});
test('Точки перегородки в горизонтальной детали используют её центр', () => {
  const r = calc({ ...profile, bodyFixing: 'confirmat', sections: [{}, {}] });
  assert.deepEqual(r.drilling.errors, {});
  const top = r.drilling.panels.find(p => p.name === 'Верх');
  assert.deepEqual(top.holes.filter(h => h.surface.startsWith('Плоскость')).map(h => h.x), [384, 384]);
});
test('Для шурупов параметры отверстий задаются отдельно', () => {
  const r = calc({ drilling: true, drillOffset: 50, bodyFixing: 'screw', screwThrough: 3.5, screwPilot: 2.5, screwDepth: 36 });
  assert.deepEqual(r.drilling.errors, {}); assert.equal(r.drilling.panels[0].holes[0].diameter, 3.5);
});
test('Незаполненный шаблон блокирует схемы, сохраняя спецификацию', () => {
  const r = calc({ bodyFixing: 'eccentric', drilling: true, drillOffset: 50 });
  assert.deepEqual(r.errors, {}); assert.equal(r.parts.length, 3); assert.ok(r.drilling.errors.camDiameter); assert.deepEqual(r.drilling.panels, []);
});
test('Собственный шаблон эксцентрика Ø16 строит чашку, вход и отверстие штока', () => {
  const r = calc({ bodyFixing: 'eccentric', drilling: true, drillOffset: 50, camDiameter: 16, camDepth: 12.5, camEdge: 34, camEntryDiameter: 7, camPinDiameter: 5, camPinDepth: 10 });
  assert.deepEqual(r.drilling.errors, {});
  const top = r.drilling.panels.find(p => p.name === 'Верх');
  assert.equal(top.holes.filter(h => h.purpose === 'Под эксцентрик').length, 4);
  assert.equal(top.holes.find(h => h.purpose === 'Под эксцентрик').x, 34);
});
test('Для шканта проверяется суммарная глубина и толщина плиты', () => {
  const r = calc({ bodyFixing: 'dowel', drilling: true, drillOffset: 50, dowelDiameter: 8, dowelFaceDepth: 10, dowelEndDepth: 22 });
  assert.deepEqual(r.drilling.errors, {});
  assert.ok(calc({ bodyFixing: 'dowel', drilling: true, drillOffset: 50, dowelDiameter: 8, dowelFaceDepth: 5, dowelEndDepth: 10 }).drilling.errors.dowelEndDepth);
});
test('Пересекающиеся отверстия съёмных полок на двух сторонах перегородки блокируют схему', () => {
  const r = calc({ shelfFixing: 'supports', sections: [{ shelves: 1 }, { shelves: 1 }], drilling: true, drillOffset: 50, supportDiameter: 5, supportDepth: 9 });
  assert.ok(r.drilling.errors.collision); assert.deepEqual(r.drilling.panels, []);
  const staggered = calc({ shelfFixing: 'supports', sections: [{ shelves: 1, shelfLevels: '250' }, { shelves: 1, shelfLevels: '300' }], drilling: true, drillOffset: 50, supportDiameter: 5, supportDepth: 9 });
  assert.deepEqual(staggered.drilling.errors, {});
});
test('Фиксированные полки требуют нулевого зазора и имеют назначаемые уровни', () => {
  const bad = calc({ ...profile, shelfFixing: 'confirmat', sections: [{ shelves: 1 }] }); assert.ok(bad.drilling.errors.shelfGap);
  const good = calc({ ...profile, shelfFixing: 'confirmat', shelfGap: 0, sections: [{ shelves: 1, shelfLevels: '300' }] });
  assert.deepEqual(good.drilling.errors, {}); assert.ok(good.drilling.panels.some(p => p.name.includes('полка 1')));
});
test('Некорректные количества крепежа блокируют спецификацию', () => {
  for (const bodyPoints of [0, 1.5, 'abc', 11]) { const r = calc({ bodyFixing: 'confirmat', bodyPoints }); assert.ok(r.errors.bodyPoints); assert.deepEqual(r.parts, []); }
});
test('Геометрия корпуса не меняется от крепежа, ручная фурнитура сохраняется', () => {
  const r = calc({ bodyFixing: 'confirmat', hardware: [{ name: 'Ручка', quantity: 4 }] });
  assert.equal(r.parts[0].length, 720); assert.equal(r.hardware[0].quantity, 4); assert.equal(r.hardware[1].quantity, 8); assert.equal(r.totals.quantity, 4);
});
test('Артикулы корпуса и полок сохраняются отдельно', () => {
  const r = calc({ bodyFixing: 'confirmat', shelfFixing: 'supports', bodyArticle: '7x50-A', shelfArticle: '5mm-B', sections: [{ shelves: 1 }] });
  assert.deepEqual(r.hardware.map(p => p.article), ['7x50-A', '5mm-B']);
});
test('Комбинированный крепёж сверлится с разных сторон боковины', () => {
  const r = calc({ ...profile, bodyFixing: 'confirmat_dowel', dowelDiameter: 8, dowelFaceDepth: 10, dowelEndDepth: 22, dowelOffset: 82 });
  assert.deepEqual(r.drilling.errors, {});
  const side = r.drilling.panels[0];
  assert.equal(side.holes.find(h => h.purpose === 'Под шкант').surface, 'Плоскость A');
  assert.equal(side.holes.find(h => h.purpose.includes('конфирмат')).surface, 'Плоскость B');
});
test('Слишком маленькие детали и пересечения блокируют экспорт схем', () => {
  const r = calc({ ...profile, bodyFixing: 'confirmat', depth: 90 }); assert.ok(r.drilling.errors.drillOffset); assert.deepEqual(r.drilling.panels, []);
  const combined = calc({ ...profile, bodyFixing: 'confirmat_dowel', dowelDiameter: 8, dowelFaceDepth: 10, dowelEndDepth: 22, dowelOffset: 50 });
  assert.ok(combined.drilling.errors.collision);
});
