import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparSuministros, resolutorSuministro } from '../suministros.ts';

const COCINA = { cups: 'ES0238330000167922NX', numeroContador: '816000231', direccionSuministro: 'Av. Mèxic 1 – GAS COCINA' };
const ENFR = { cups: 'ES0238330000091292SQ', numeroContador: '315001233', direccionSuministro: 'Av. Mèxic 1 – ENFRIADORA' };

test('el CUPS, el nº de contador y el contrato de una misma factura forman un solo suministro', () => {
  const s = agruparSuministros([{ ...COCINA }, { ...ENFR }, { contador: '816000231' }, { contador: 'ES0238330000091292SQ' }, { contador: '315001233' }]);
  assert.equal(s.length, 2);
  const c = s.find((x) => x.direccion?.endsWith('COCINA'))!;
  assert.equal(c.id, 'ES0238330000167922NX'); assert.ok(c.identificadores.includes('816000231'));
});
test('un identificador suelto se traduce a la etiqueta del suministro que lo conoce', () => {
  const r = resolutorSuministro([COCINA, ENFR]);
  assert.equal(r('816000231'), r('ES0238330000167922NX'));
  assert.match(r('315001233')!, /ENFRIADORA/);
  assert.equal(r('XYZ-9'), 'XYZ-9'); assert.equal(r(''), undefined);
});
test('dos suministros distintos no se unen y VARIOS no une nada', () => {
  assert.equal(agruparSuministros([{ contador: 'AAA1' }, { contador: 'BBB2' }, { contador: 'VARIOS', cups: 'AAA1' }]).length, 2);
});
