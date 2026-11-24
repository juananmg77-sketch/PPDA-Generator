import test from 'node:test';
import assert from 'node:assert/strict';
import { cupsValido, repararCups } from '../cups.ts';

test('el dígito de control valida CUPS reales y detecta lecturas erróneas', () => {
  assert.equal(cupsValido('ES0238330000167922NX'), true);
  assert.equal(cupsValido('ES0031500199603001ES0F'), true); // con los 2 caracteres finales de la factura
  assert.equal(cupsValido('ES0031500189603001ES'), false); // un 9 leído como 8
  assert.equal(cupsValido('816000231'), null);
});
test('una lectura con una cifra mal se corrige si la corrección es única o la conoce el centro', () => {
  const conocidos = ['ES0031500199603001ES'];
  assert.deepEqual(repararCups('ES0031500119603001ES', conocidos), { cups: 'ES0031500199603001ES', corregido: true, leido: 'ES0031500119603001ES' });
  const r = repararCups('ES0031500189603001ES');
  assert.ok(r.corregido || r.invalido); // sin contexto: solo se corrige si hay una única posibilidad
  // cifra sobrante (17 cifras)
  assert.equal(repararCups('ES00315001099603001ES0F', conocidos).cups, 'ES0031500199603001ES');
  // válido: no se toca; no es CUPS: se devuelve igual
  assert.deepEqual(repararCups('ES0238330000167922NX'), { cups: 'ES0238330000167922NX', corregido: false });
  assert.equal(repararCups('816000231').cups, '816000231');
});
