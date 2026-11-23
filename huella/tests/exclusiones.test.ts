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
