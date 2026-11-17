// Paquete del verificador: libro Excel con los datos, el recálculo con fórmulas visibles y los factores, para auditar el inventario sin depender del software.
import * as XLSX from 'xlsx';
import type { DatosInforme } from './informe.ts';

type Fila = Array<string | number | null | { f: string; v: number }>;
const hoja = (filas: Fila[], anchos?: number[]) => {
  const ws = XLSX.utils.aoa_to_sheet(filas.map((r) => r.map((c) => (c && typeof c === 'object' ? (null as unknown as string) : c))));
  // las fórmulas se escriben celda a celda para conservar su valor calculado
  filas.forEach((r, i) => r.forEach((c, j) => { if (c && typeof c === 'object') ws[XLSX.utils.encode_cell({ r: i, c: j })] = { t: 'n', f: c.f, v: c.v }; }));
  if (anchos) ws['!cols'] = anchos.map((wch) => ({ wch }));
  return ws;
};

export function paqueteAXlsx(d: DatosInforme): Blob {
  const f = d.factores;
  const wb = XLSX.utils.book_new();

  const t = d.totales;
  XLSX.utils.book_append_sheet(wb, hoja([
    ['Paquete del verificador · inventario de GEI'], [],
    ['Organización', d.organizacion.nombre], ['CIF', d.organizacion.cif ?? ''], ['Año del inventario', d.inventario.anio], ['Estado', d.inventario.estado], ['Fecha de emisión', d.fecha], ['Emitido por', d.emitidoPor], [],
    ['Conjunto de factores', f.id], ['Procedencia', f.procedencia], ['GWP CH4', f.gwp.ch4], ['GWP N2O', f.gwp.n2o], ['Fuente de los GWP', f.gwp.fuente], ['Mix eléctrico balear (kg CO2e/kWh)', f.mixElectrico], [],
    ['Alcance 1 (kg CO2e)', Math.round(t.kgCO2eAlcance1 * 100) / 100], ['Alcance 2 (kg CO2e)', Math.round(t.kgCO2eAlcance2 * 100) / 100], ['Total (kg CO2e)', Math.round(t.kgCO2eTotal * 100) / 100],
    [], ['Hojas', 'Actividad: datos de entrada con su evidencia · Recálculo: fórmulas para reproducir cada línea · Factores · Evidencias'],
  ], [38, 70]), 'Resumen');

  XLSX.utils.book_append_sheet(wb, hoja([
    ['Centro', 'Categoría', 'Fuente', 'Contador', 'Periodo desde', 'Periodo hasta', 'Cantidad', 'Origen electricidad', 'Evidencia (factura)', 'Notas'],
    ...d.actividad.map((a) => [a.centro, a.categoria, a.fuente, a.contador ?? '', a.periodoDesde ?? '', a.periodoHasta ?? '', a.cantidad, a.origenElectricidad ?? '', a.documento ?? '', a.notas ?? '']),
  ], [22, 18, 30, 24, 12, 12, 14, 22, 36, 30]), 'Actividad');

  // Recálculo con fórmulas: cantidad × factor (+ CH4 y N2O con los GWP) × reparto; la última columna compara con el motor.
  const cab: Fila = ['Centro', 'Fuente', 'Cantidad', 'Factor CO2 o único (kg/ud)', 'Factor CH4 (g/ud)', 'Factor N2O (g/ud)', 'GWP CH4', 'GWP N2O', 'Reparto', 'kg CO2e (fórmula)', 'kg CO2e (motor)', 'Diferencia'];
  const filas: Fila[] = [cab];
  d.resultados.forEach((r, i) => {
    const n = i + 2;
    const l = r.linea;
    const rep = l.reparto?.proporcion ?? 1;
    let f1 = 0, ch = 0, n2 = 0, formula: string, valor: number;
    if (l.categoria === 'electricidad') {
      f1 = r.electricidad && (l.origenElectricidad === 'autoconsumo' || l.origenElectricidad === 'gdo_renovable_balear') ? 0 : f.mixElectrico;
      formula = `C${n}*D${n}*I${n}`; valor = l.cantidad * f1 * rep;
    } else if (l.categoria === 'fugitiva') {
      f1 = f.pcaRefrigerantes[l.fuente] ?? 0;
      formula = `C${n}*D${n}*I${n}`; valor = l.cantidad * f1 * rep;
    } else {
      const fc = f.combustibles[l.fuente];
      f1 = fc?.co2 ?? 0; ch = fc?.ch4 ?? 0; n2 = fc?.n2o ?? 0;
      formula = `C${n}*(D${n}+E${n}/1000*G${n}+F${n}/1000*H${n})*I${n}`; valor = l.cantidad * (f1 + (ch / 1000) * f.gwp.ch4 + (n2 / 1000) * f.gwp.n2o) * rep;
    }
    filas.push([l.centro, l.fuente || `Electricidad (${l.origenElectricidad ?? 'red'})`, l.cantidad, f1, ch, n2, f.gwp.ch4, f.gwp.n2o, rep, { f: formula, v: valor }, Math.round(r.kgCO2e * 1e6) / 1e6, { f: `J${n}-K${n}`, v: valor - r.kgCO2e }]);
  });
  const fin = d.resultados.length + 1;
  filas.push([], ['Total', '', '', '', '', '', '', '', '', { f: `SUM(J2:J${fin})`, v: d.resultados.reduce((s, r) => s + r.kgCO2e, 0) }, { f: `SUM(K2:K${fin})`, v: d.resultados.reduce((s, r) => s + r.kgCO2e, 0) }, { f: `SUM(L2:L${fin})`, v: 0 }]);
  XLSX.utils.book_append_sheet(wb, hoja(filas, [22, 32, 14, 20, 16, 16, 10, 10, 10, 18, 18, 14]), 'Recálculo');

  XLSX.utils.book_append_sheet(wb, hoja([
    ['Concepto', 'Clave', 'Valor 1', 'Valor 2', 'Valor 3'],
    ...Object.entries(f.combustibles).filter(([k]) => d.actividad.some((a) => a.fuente === k)).map(([k, x]) => ['Combustible', k, x.co2 ?? '', x.ch4 ?? '', x.n2o ?? ''] as Fila),
    ...Object.entries(f.pcaRefrigerantes).filter(([k]) => d.actividad.some((a) => a.fuente === k)).map(([k, x]) => ['PCA refrigerante', k, x, '', ''] as Fila),
    ['Mix eléctrico balear', String(d.inventario.anio), f.mixElectrico, '', ''],
    ['GWP', 'CH4 / N2O', f.gwp.ch4, f.gwp.n2o, f.gwp.fuente],
    ...f.notas.map((n) => ['Ajuste manual', '', n, '', ''] as Fila),
  ], [20, 36, 16, 16, 30]), 'Factores');

  XLSX.utils.book_append_sheet(wb, hoja([
    ['Documento', 'Tipo', 'Centro', 'Periodo desde', 'Periodo hasta', 'Estado'],
    ...d.documentos.map((x) => [x.nombre, x.tipo, x.centro, x.periodoDesde ?? '', x.periodoHasta ?? '', x.estado] as Fila),
  ], [44, 20, 24, 14, 14, 14]), 'Evidencias');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
