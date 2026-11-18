// Mezclas de refrigerantes que la calculadora oficial no trae: su potencial de calentamiento (PCA) se calcula como la media ponderada
// por masa de los PCA de sus componentes, con los valores del propio conjunto de factores (así es coherente con las demás mezclas de la calculadora).
import type { ConjuntoFactores } from './tipos.ts';

/** PCA de los HFO usados en las mezclas (IPCC AR6 / Reglamento (UE) 2024/573, anexo II); la calculadora oficial no los incluye. */
export const PCA_HFO: Record<string, number> = { 'HFO-1234yf': 0.501, 'HFO-1234ze(E)': 1.37 };

/** Composición en fracción de masa. Solo se incluyen mezclas con composición contrastada con la ficha del fabricante. */
export const MEZCLAS: Record<string, { componentes: Record<string, number>; fuente: string }> = {
  'R-448A': {
    componentes: { 'HFC-32': 0.26, 'HFC-125': 0.26, 'HFC-134a': 0.21, 'HFO-1234yf': 0.2, 'HFO-1234ze(E)': 0.07 },
    fuente: 'Composición según las fichas de Arkema (Forane 448A), Honeywell (Solstice N40) y UNEP: R-32 26 %, R-125 26 %, R-134a 21 %, R-1234yf 20 %, R-1234ze(E) 7 %.',
  },
};

/** «R448A», «r 448a» o «R-448 A» → «R-448A», que es como se llaman en la tabla de la calculadora. */
export function normalizarGas(g?: string): string {
  const x = (g ?? '').trim().toUpperCase().replace(/[\s_]+/g, '');
  const m = /^R-?(\d{2,3})-?([A-Z]?)$/.exec(x);
  return m ? `R-${m[1]}${m[2]}` : (g ?? '').trim();
}

/** PCA de una mezcla a partir de las tablas del conjunto; null si falta algún componente. */
export function pcaMezcla(nombre: string, pcas: Record<string, number>, mezclas = MEZCLAS): number | null {
  const mz = mezclas[nombre];
  if (!mz) return null;
  let total = 0;
  for (const [comp, fraccion] of Object.entries(mz.componentes)) {
    const v = pcas[comp] ?? PCA_HFO[comp];
    if (typeof v !== 'number') return null;
    total += fraccion * v;
  }
  return Math.round(total * 100) / 100;
}

/** Devuelve el conjunto con las mezclas que faltan ya calculadas, dejando constancia en las notas (aparecen en el informe). */
export function conMezclas(f: ConjuntoFactores): ConjuntoFactores {
  const nuevas: Record<string, number> = {};
  const notas: string[] = [];
  for (const nombre of Object.keys(MEZCLAS)) {
    if (f.pcaRefrigerantes[nombre] !== undefined) continue;
    const v = pcaMezcla(nombre, f.pcaRefrigerantes);
    if (v === null) continue;
    nuevas[nombre] = v;
    const mz = MEZCLAS[nombre];
    notas.push(`PCA de ${nombre} (mezcla no incluida en la calculadora oficial): ${v.toLocaleString('es-ES')}, media ponderada por masa de sus componentes con los PCA de este conjunto (${Object.entries(mz.componentes).map(([c, x]) => `${c} ${Math.round(x * 100)} %`).join(', ')}; HFO: AR6 ${Object.entries(PCA_HFO).map(([c, x]) => `${c} ${x}`).join(', ')}). ${mz.fuente}`);
  }
  if (!notas.length) return f;
  return { ...f, pcaRefrigerantes: { ...f.pcaRefrigerantes, ...nuevas }, notas: [...f.notas.filter((n) => !notas.includes(n)), ...notas] };
}
