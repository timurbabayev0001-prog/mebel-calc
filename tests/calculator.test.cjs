const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculate } = require('../calculator.js');
const example = { width: '800', height: '720', depth: '500', thickness: '16' };
test('Контрольный пример: четыре детали с правильными размерами', () => {
  const result = calculate(example);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.parts, [
    { name: 'Боковина', length: 720, depth: 500, quantity: 2 },
    { name: 'Верх и низ', length: 768, depth: 500, quantity: 2 }
  ]);
});
test('ЛДСП 18 мм: меняется только ширина горизонтальных деталей', () => {
  const result = calculate({ ...example, thickness: '18' });
  assert.equal(result.parts[1].length, 764);
  assert.equal(result.parts[0].length, 720);
});
test('Пустые, отрицательные, дробные и некорректные размеры отклоняются', () => {
  for (const field of ['width', 'height', 'depth']) {
    for (const value of ['', ' ', '0', '-1', '2.5', '2,5', 'abc', 'Infinity', '1e3', '9007199254740992']) {
      const result = calculate({ ...example, [field]: value });
      assert.ok(result.errors[field], `${field}: ${value}`);
      assert.deepEqual(result.parts, []);
    }
  }
});
test('Корпус должен иметь положительное внутреннее пространство', () => {
  for (const thickness of [16, 18]) {
    for (const field of ['width', 'height']) {
      assert.ok(calculate({ ...example, thickness, [field]: thickness * 2 }).errors[field]);
      assert.deepEqual(calculate({ ...example, thickness, [field]: thickness * 2 + 1 }).errors, {});
    }
  }
});
test('Неподдерживаемая толщина отклоняется', () => {
  assert.ok(calculate({ ...example, thickness: '20' }).errors.thickness);
});
test('Допускаются пробелы вокруг целого размера', () => {
  assert.equal(calculate({ ...example, width: ' 800 ' }).parts[1].length, 768);
});
