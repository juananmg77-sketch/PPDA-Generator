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
