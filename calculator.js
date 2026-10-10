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
  root.MebelCalc = { calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculate };
})(typeof window === 'undefined' ? globalThis : window);
