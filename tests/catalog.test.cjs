const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateProject } = require('../calculator.js');
const { configure, decor, safeImage, csv } = require('../catalog.js');
const base = { width: 800, height: 720, depth: 500, thickness: 16 };
const calc = extra => { const v = { ...base, ...extra }; return configure(v, calculateProject(v)); };
const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1kAAAAASUVORK5CYII=';
test('Цвета корпуса и фасадов присваиваются отдельно и разбивают площадь по декору', () => {
  const r = calc({ decors: { body: { id: 'oak' }, front: { id: 'graphite' } }, sections: [{ front: 'doors', doors: 2 }] });
  assert.deepEqual(r.errors, {});
  assert.equal(r.parts.find(p => p.name === 'Боковина').decor, 'Дуб натуральный');
  assert.equal(r.parts.find(p => p.name.includes('дверь')).decor, 'Графит');
  assert.equal(r.totals.materials.length, 2);
  assert.ok(Math.abs(r.totals.materials.reduce((s, m) => s + m.area, 0) - r.totals.area) < 1e-9);
});
test('Свой декор с изображением переживает сохранение проекта в JSON', () => {
  const values = JSON.parse(JSON.stringify({ decors: { body: { id: 'custom', name: 'Дуб H1234', image: tiny } } }));
  const r = calc(values);
  assert.equal(r.decors.body.image, tiny);
  assert.equal(r.parts[0].decor, 'Дуб H1234');
});
test('Столешница имеет свои размеры, декор, материал и площадь', () => {
  const r = calc({ countertop: 'on', countertopLength: 850, countertopDepth: 550, countertopThickness: 38, decors: { countertop: { id: 'walnut' } } });
  assert.deepEqual(r.errors, {});
  const p = r.parts.find(p => p.name === 'Столешница');
  assert.deepEqual([p.length, p.depth, p.thickness, p.decor], [850, 550, 38, 'Орех']);
  assert.equal(r.totals.quantity, 5);
  assert.ok(Math.abs(r.totals.area - (1.488 + .4675)) < 1e-9);
  assert.equal(r.dimensions.width, 800);
});
test('Отключённая столешница не влияет на спецификацию', () => {
  assert.equal(calc({ countertopLength: -1 }).parts.length, 3);
});
test('Ручки, петли, направляющие и ручное количество', () => {
  const r = calc({ sections: [{ front: 'doors', doors: 2 }, { front: 'drawers', drawers: 3 }], hardware: [
    { name: 'Ручка', basis: 'fronts', quantity: 1 },
    { name: 'Петля', basis: 'doors', quantity: 2 },
    { name: 'Направляющие', basis: 'drawers', quantity: 1, unit: 'пар' },
    { name: 'Ножка', basis: 'manual', quantity: 4, image: tiny }
  ] });
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.hardware.map(p => p.quantity), [5, 4, 3, 4]);
  assert.equal(r.hardware[2].unit, 'пар');
  assert.equal(r.hardware[3].image, tiny);
  assert.equal(r.totals.quantity, 25); // board parts only: 4 + divider + 2 doors + 18 drawer parts
});
test('Количество фурнитуры пересчитывается после изменения дверей', () => {
  const hardware = [{ name: 'Ручка', quantity: 1, basis: 'fronts' }];
  assert.equal(calc({ hardware }).hardware[0].quantity, 0);
  assert.equal(calc({ hardware, sections: [{ front: 'doors', doors: 2 }] }).hardware[0].quantity, 2);
});
test('Дополнительная деталь может использовать декор фасадов', () => {
  const r = calc({ decors: { front: { id: 'cashmere' } }, extras: [{ name: 'Добор', length: 500, depth: 60, thickness: 16, quantity: 1, decor: 'front' }] });
  assert.deepEqual(r.errors, {});
  assert.equal(r.parts.find(p => p.name === 'Добор').decor, 'Кашемир');
});
test('Ошибки размеров столешницы и фурнитуры скрывают результат', () => {
  for (const v of [{ countertop: true, countertopLength: 0 }, { hardware: [null] }, { hardware: [{ name: '' }] }, { hardware: [{ name: 'Ручка', quantity: 1.5 }] }, { hardware: [{ name: 'Ручка', quantity: -1 }] }, { hardware: [{ name: 'Ручка', basis: '__proto__' }] }, { hardware: [{ name: 'Ручка', unit: 'кг' }] }, { hardware: Array(31).fill({ name: 'Ручка' }) }]) {
    const r = calc(v); assert.ok(Object.keys(r.errors).length); assert.deepEqual(r.parts, []); assert.deepEqual(r.hardware, []);
  }
});
test('Изображения ограничены растровыми данными и размером', () => {
  assert.equal(safeImage(tiny), tiny);
  for (const value of ['https://example.com/photo.jpg', 'javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,' + 'A'.repeat(350000), null]) assert.equal(safeImage(value), '');
  assert.equal(decor({ id: 'custom', image: 'javascript:alert(1)' }).image, '');
});
test('CSV содержит декоры, артикулы и количества фурнитуры и экранирует формулы', () => {
  const r = calc({ hardware: [{ name: '=1+1', article: 'H-123', quantity: 4, note: 'Чёрная; 128 мм' }] });
  const text = csv(r);
  assert.ok(text.includes('Декор / артикул'));
  assert.ok(text.includes('"Белый"'));
  assert.ok(text.includes('"\'=1+1"'));
  assert.ok(text.includes('"H-123";"4";"шт."'));
  assert.ok(text.includes('"Чёрная; 128 мм"'));
});
test('Ошибки базового корпуса сохраняются, цвета не обходят проверку размеров', () => {
  const r = calc({ width: -1 }); assert.ok(r.errors.width); assert.deepEqual(r.parts, []); assert.deepEqual(r.hardware, []);
});
