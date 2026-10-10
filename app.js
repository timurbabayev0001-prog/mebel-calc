'use strict';
const form = document.querySelector('#calculator');
const resultContent = document.querySelector('#result-content');
const status = document.querySelector('#status');
function update() {
  const values = Object.fromEntries(new FormData(form));
  const result = window.MebelCalc.calculate(values);
  for (const key of ['width', 'height', 'depth']) {
    document.getElementById(`${key}-error`).textContent = result.errors[key] || '';
    document.getElementById(key).setAttribute('aria-invalid', String(Boolean(result.errors[key])));
  }
  const valid = Object.keys(result.errors).length === 0;
  resultContent.hidden = !valid;
  document.querySelector('#empty-state').hidden = valid;
  status.classList.toggle('invalid', !valid);
  status.textContent = valid ? '✓ Расчёт готов' : (result.errors.thickness || 'Не удалось рассчитать корпус: проверьте размеры.');
  const rows = document.querySelector('#parts');
  rows.replaceChildren();
  if (!valid) return;
  document.querySelector('#dimensions').textContent = `${result.dimensions.width} × ${result.dimensions.height} × ${result.dimensions.depth} мм`;
  document.querySelector('#material').textContent = `ЛДСП ${result.thickness} мм`;
  document.querySelector('#formula').textContent = `Ширина верха и низа: ${result.dimensions.width} − 2 × ${result.thickness} = ${result.parts[1].length} мм`;
  for (const part of result.parts) {
    const row = document.createElement('tr');
    for (const value of [part.name, `${part.length} × ${part.depth}`, `${part.quantity} шт.`]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    rows.append(row);
  }
}
form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
  form.querySelector('[aria-invalid="true"]')?.focus();
});
update();
