// Catálogo de versiones de factores de emisión (una por edición de la calculadora oficial) y elección por año de inventario.
// Un mismo año puede tener valores distintos según la edición del documento (p. ej. gasóleo C 2023: 2,705 en la 2023.2 y 2,881 en la 2024.1),
// por eso la versión usada se elige por inventario, se muestra y se guarda con él.
import { construirConjunto } from './factores.ts';
import { conMezclas } from './mezclas.ts';
import type { ConjuntoFactores, DatosCalculadora } from './tipos.ts';

export interface VersionFactores {
  id: string;
  etiqueta: string;
  cargar: () => Promise<DatosCalculadora>;
}

export const VERSIONES: VersionFactores[] = [
  { id: '2024.1', etiqueta: 'Calculadora 2024.1 (hasta el año 2024)', cargar: async () => (await import('./datos/factores-calculadora-2024.1.json')).default as unknown as DatosCalculadora },
  { id: '2023.2', etiqueta: 'Calculadora 2023.2 (hasta el año 2023)', cargar: async () => (await import('./datos/factores-calculadora-2023.2.json')).default as unknown as DatosCalculadora },
];

/** Una versión sirve para un año si trae el mix eléctrico y factores de combustible de ese año. */
export function cubreAnio(d: DatosCalculadora, anio: number): boolean {
  const a = String(anio);
  return typeof d.mixElectricoBalear[a] === 'number' && Object.values(d.combustiblesFijos).some((x) => !!x.porAnio[a]);
}

/** Por defecto, la edición más reciente que cubra el año (los factores de un año se revisan en ediciones posteriores). */
export function versionPorDefecto(ids: string[]): string | undefined {
  return [...ids].sort().reverse()[0];
}

export interface Diferencias {
  mix: [number, number] | null;
  gwp: boolean;
  pca: number;
  combustibles: Array<{ clave: string; a: number | null; b: number | null }>;
}

/** Qué cambia al usar el conjunto `a` en lugar del `b` (para avisar al elegir versión). */
export function diferencias(a: ConjuntoFactores, b: ConjuntoFactores): Diferencias {
  const claves = new Set([...Object.keys(a.combustibles), ...Object.keys(b.combustibles)]);
  const combustibles: Diferencias['combustibles'] = [];
  for (const k of claves) {
    const x = a.combustibles[k]?.co2 ?? null;
    const y = b.combustibles[k]?.co2 ?? null;
    if (x !== y) combustibles.push({ clave: k, a: x, b: y });
  }
  const gases = new Set([...Object.keys(a.pcaRefrigerantes), ...Object.keys(b.pcaRefrigerantes)]);
  let pca = 0;
  for (const g of gases) if (a.pcaRefrigerantes[g] !== b.pcaRefrigerantes[g]) pca++;
  return {
    mix: a.mixElectrico !== b.mixElectrico ? [a.mixElectrico, b.mixElectrico] : null,
    gwp: a.gwp.ch4 !== b.gwp.ch4 || a.gwp.n2o !== b.gwp.n2o,
    pca,
    combustibles,
  };
}

export interface ConjuntoElegido {
  conjunto: ConjuntoFactores;
  /** Versiones que cubren el año (la primera es la propuesta por defecto). */
  disponibles: string[];
  /** Conjuntos de las demás versiones disponibles, para compararlos. */
  alternativas: Record<string, ConjuntoFactores>;
}

/** Carga el conjunto de un año con la versión pedida (o la propuesta). Lanza error si ninguna versión cubre el año. */
export async function cargarConjunto(anio: number, version?: string): Promise<ConjuntoElegido> {
  const conjuntos: Record<string, ConjuntoFactores> = {};
  for (const v of VERSIONES) {
    const datos = await v.cargar();
    if (cubreAnio(datos, anio)) conjuntos[v.id] = conMezclas(construirConjunto(datos, { anioInventario: anio }));
  }
  const disponibles = Object.keys(conjuntos).sort().reverse();
  if (disponibles.length === 0) throw new Error(`Ninguna versión de factores cubre el año ${anio}: hay que incorporar la calculadora o la resolución correspondiente.`);
  const id = version && conjuntos[version] ? version : versionPorDefecto(disponibles)!;
  const alternativas = { ...conjuntos };
  delete alternativas[id];
  return { conjunto: conjuntos[id], disponibles, alternativas };
}

/** Gases de la lista de la calculadora oficial de una versión (los demás se declaran en «Otros»). */
export async function gasesOficiales(version: string): Promise<string[]> {
  const v = VERSIONES.find((x) => x.id === version.replace(/^calculadora-/, ''));
  if (!v) return [];
  const d = await v.cargar();
  return [...Object.keys(d.refrigerantes), ...Object.keys(d.otrosGases)];
}
