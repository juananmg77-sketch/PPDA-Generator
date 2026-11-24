import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularExtintores, porcentajeExcluido, justificacionExtintores } from '../exclusiones.ts';

test('extintores: total recargados, kg, t y porcentaje sobre el total con la exclusión', () => {
  const c = calcularExtintores([{ cantidad: 4, kgPorExtintor: 5 }, { cantidad: 2, kgPorExtintor: 2 }, { cantidad: 0, kgPorExtintor: 9 }], 500);
  assert.equal(c.totalExtintores, 6);
  assert.equal(c.kgCO2, 24);
  assert.equal(c.tCO2e, 0.024);
  assert.ok(Math.abs(c.porcentaje - (0.024 / 500.024) * 100) < 1e-9);
  assert.match(justificacionExtintores(c), /6 extintor\(es\) de CO₂/);
});
test('porcentaje con total 0 no divide por cero', () => assert.equal(porcentajeExcluido(0, 0), 0));

import { incluirPorDefecto, agruparPorKg, limpiarLectura } from '../extintores.ts';
test('lectura de extintores: por defecto solo CO2 recarga/retimbrado y de factura si la hay', () => {
  const base = { agente: 'CO2' as const, kgPorExtintor: 2, cantidad: 3 };
  const l = [
    { ...base, documento: 'factura' as const, concepto: 'Retimbrado CO2', operacion: 'retimbrado' as const },
    { ...base, documento: 'parte_revision' as const, concepto: 'Retimbrado', operacion: 'retimbrado' as const },
    { ...base, documento: 'factura' as const, concepto: 'Extintor nuevo', operacion: 'nuevo' as const },
    { ...base, agente: 'polvo' as const, documento: 'factura' as const, concepto: 'ABC', operacion: 'recarga' as const },
  ];
  assert.deepEqual(incluirPorDefecto(l), [true, false, false, false]);
  assert.deepEqual(agruparPorKg([{ cantidad: 3, kgPorExtintor: 2 }, { cantidad: 1, kgPorExtintor: 5 }, { cantidad: 2, kgPorExtintor: 2 }]), [{ cantidad: 5, kgPorExtintor: 2 }, { cantidad: 1, kgPorExtintor: 5 }]);
  assert.equal(limpiarLectura({ lineas: [{ ...l[0], cantidad: 0 }] }).lineas.length, 0);
});

import { centroDesdeHotel, organizacionDesdeHotel, coordenada } from '../hotelesSuite.ts';
test('hoteles de HS Suite: coordenadas y CNAE de hotel', () => {
  const h = { id: 'x', codigo_hotel: 'HS-1', nombre_hotel: 'H', cadena_hotelera: null, titular: null, cif: null, pais: 'España', ccaa: 'Illes Balears', isla: 'Mallorca', municipio: 'Alcúdia', direccion_completa: 'C/ A', num_habitaciones: 10, num_plazas: 0, activo: true, latitud: '39.8330436', longitud: 3.1167803 };
  const c = centroDesdeHotel(h);
  assert.equal(c.latitud, 39.8330436); assert.equal(c.longitud, 3.1167803);
  assert.equal(centroDesdeHotel({ ...h, latitud: undefined, longitud: null }).latitud, null);
  assert.equal(coordenada('120', 90), null);
  assert.equal(organizacionDesdeHotel(h).cnae, '5510');
});

test('la exclusión de extintores se recalcula con el total actual del inventario y respeta el texto editado a mano', async () => {
  const { calcularExtintores, justificacionExtintores, refrescarExclusion } = await import('../exclusiones.ts');
  const calc = { ...calcularExtintores([{ cantidad: 26, kgPorExtintor: 4.42 }] as never, 435.42), certificadoNombre: 'cert.pdf' };
  const x = { porcentaje: 0.026, justificacion: justificacionExtintores(calc as never), calculo: calc as never };
  const r = refrescarExclusion(x, 527.94);
  assert.equal(r.porcentaje, Math.round(((calc.tCO2e / (527.94 + calc.tCO2e)) * 100) * 1000) / 1000);
  assert.match(r.justificacion, /527,94 t CO₂e sin la exclusión/); assert.ok(!/435,42/.test(r.justificacion));
  const editada = refrescarExclusion({ ...x, justificacion: 'Texto escrito por la persona responsable.' }, 527.94);
  assert.equal(editada.justificacion, 'Texto escrito por la persona responsable.'); assert.notEqual(editada.porcentaje, 0.026);
  assert.equal(refrescarExclusion({ porcentaje: 3, justificacion: 'x' }, 527.94).porcentaje, 3); // otras exclusiones no cambian
});
