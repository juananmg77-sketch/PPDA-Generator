// Incertidumbre del inventario (ISO 14064-1:2018, 8.3 y 9.3.1 p/q). Método 1 del IPCC (2006, vol. 1, cap. 3): en un producto (dato × factor) las incertidumbres relativas
// se combinan con la raíz de la suma de cuadrados; en una suma de fuentes independientes, la incertidumbre absoluta es la raíz de la suma de cuadrados de las absolutas.
// Los valores por defecto son un CATÁLOGO CONFIGURABLE (orientativo: el verificador puede pedir otros); cada línea puede ajustarlos con justificación.
import type { AjusteIncertidumbre, ConjuntoFactores, OrigenDato, ResultadoLinea } from './tipos.ts';
import { CATEGORIA_ISO_FUENTE } from './iso.ts';
import { MEZCLAS, normalizarGas } from './mezclas.ts';
import { fmt } from './formato.ts';

export const ORIGENES_DATO: Record<OrigenDato, string> = {
  factura: 'Factura', albaran: 'Albarán', lectura_interna: 'Lectura interna', estimacion: 'Estimación', parte_mantenimiento: 'Parte de mantenimiento',
};

export interface ConfigIncertidumbre {
  /** ±% (intervalo de confianza del 95 %) del dato de actividad según su origen. */
  dato: Record<OrigenDato, number>;
  /** ±% de los factores según su tipo. */
  factor: { co2Combustible: number; ch4: number; n2o: number; mixElectrico: number; pcaGasPuro: number; pcaMezcla: number };
  /** Umbrales (±%) de la valoración cualitativa: hasta «baja» → Baja; hasta «media» → Media; hasta «alta» → Alta; por encima → Muy alta. */
  umbrales: { baja: number; media: number; alta: number };
}
export const INCERTIDUMBRE_POR_DEFECTO: ConfigIncertidumbre = {
  dato: { factura: 2, albaran: 5, lectura_interna: 5, estimacion: 25, parte_mantenimiento: 10 },
  factor: { co2Combustible: 5, ch4: 50, n2o: 100, mixElectrico: 5, pcaGasPuro: 10, pcaMezcla: 15 },
  umbrales: { baja: 5, media: 15, alta: 30 },
};
export const configIncertidumbre = (c?: Partial<ConfigIncertidumbre> | null): ConfigIncertidumbre => ({
  dato: { ...INCERTIDUMBRE_POR_DEFECTO.dato, ...(c?.dato ?? {}) }, factor: { ...INCERTIDUMBRE_POR_DEFECTO.factor, ...(c?.factor ?? {}) }, umbrales: { ...INCERTIDUMBRE_POR_DEFECTO.umbrales, ...(c?.umbrales ?? {}) },
});

export type Valoracion = 'Baja' | 'Media' | 'Alta' | 'Muy alta';
export function valoracion(pct: number | null, c: ConfigIncertidumbre): Valoracion | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return pct <= c.umbrales.baja ? 'Baja' : pct <= c.umbrales.media ? 'Media' : pct <= c.umbrales.alta ? 'Alta' : 'Muy alta';
}

/** Origen del dato de actividad por defecto: sin documento, lectura interna; recargas de gas, parte de mantenimiento; el resto, factura. */
export function origenPorDefecto(r: ResultadoLinea): OrigenDato {
  const l = r.linea;
  if (!l.evidencia) return 'lectura_interna';
  return l.categoria === 'fugitiva' ? 'parte_mantenimiento' : 'factura';
}
/** Un refrigerante es mezcla si figura en la tabla de mezclas o es de la serie R-4xx / R-5xx. */
export const esMezclaRefrigerante = (gas: string): boolean => normalizarGas(gas) in MEZCLAS || /^R-?[45]\d\d/i.test(gas.trim());

export interface ComponenteFactor { gas: string; emision: number; pct: number }
export interface IncertidumbreLinea {
  id: string; fuente: string; categoria: number; origen: OrigenDato;
  /** Emisión de la línea (kg CO₂e). */
  emision: number;
  datoPct: number; factorPct: number;
  /** ±% combinado de la línea (raíz de la suma de cuadrados del dato y del factor). */
  pct: number;
  /** Incertidumbre absoluta (kg CO₂e). */
  absoluta: number;
  /** Parte de la incertidumbre absoluta debida al dato de actividad (independiente entre líneas) y al factor (el mismo en todas las líneas de una fuente). */
  absDato: number; absFactor: number;
  ajustada: boolean; justificacion: string | null;
}

/** Incertidumbre de una línea: hereda las del catálogo y aplica el ajuste de la línea. Con varios gases el dato es común (correlacionado) y los factores son independientes. */
export function incertidumbreLinea(r: ResultadoLinea, f: ConjuntoFactores, cfg: ConfigIncertidumbre): IncertidumbreLinea {
  const l = r.linea; const aj: AjusteIncertidumbre = l.incertidumbre ?? {};
  const origen = aj.origen ?? origenPorDefecto(r);
  const datoPct = aj.datoPct ?? cfg.dato[origen];
  const E = r.kgCO2e;
  // Componentes del factor (emisión de cada gas y su ±%)
  let comps: ComponenteFactor[];
  if (l.categoria === 'electricidad') comps = [{ gas: 'mix eléctrico', emision: E, pct: cfg.factor.mixElectrico }];
  else if (l.categoria === 'fugitiva') comps = [{ gas: l.fuente, emision: E, pct: esMezclaRefrigerante(l.fuente) ? cfg.factor.pcaMezcla : cfg.factor.pcaGasPuro }];
  else {
    const ch4 = (r.gCH4 / 1000) * f.gwp.ch4, n2o = (r.gN2O / 1000) * f.gwp.n2o;
    comps = [{ gas: 'CO₂', emision: r.kgCO2, pct: cfg.factor.co2Combustible }, { gas: 'CH₄', emision: ch4, pct: cfg.factor.ch4 }, { gas: 'N₂O', emision: n2o, pct: cfg.factor.n2o }];
  }
  if (aj.factorPct != null) comps = comps.map((c) => ({ ...c, pct: aj.factorPct! }));
  const varFactor = comps.reduce((t, c) => t + (c.emision * c.pct / 100) ** 2, 0);
  const absoluta = Math.sqrt((E * datoPct / 100) ** 2 + varFactor);
  const factorPct = E > 0 ? (Math.sqrt(varFactor) / E) * 100 : Math.max(...comps.map((c) => c.pct));
  const pct = E > 0 ? (absoluta / E) * 100 : Math.sqrt(datoPct ** 2 + factorPct ** 2);
  return { id: l.id, fuente: l.fuente || 'Electricidad', categoria: CATEGORIA_ISO_FUENTE[l.categoria].n, origen, emision: E, datoPct, factorPct, pct, absoluta, absDato: E * datoPct / 100, absFactor: Math.sqrt(varFactor), ajustada: aj.datoPct != null || aj.factorPct != null || aj.origen != null, justificacion: aj.justificacion?.trim() || null };
}

export interface GrupoIncertidumbre { nombre: string; emision: number; absoluta: number; pct: number | null; valoracion: Valoracion | null; /** Fuente que más contribuye a la varianza de este grupo y su peso (%). */ principal: { fuente: string; peso: number } | null }
export interface ResultadoIncertidumbre { lineas: IncertidumbreLinea[]; porFuente: GrupoIncertidumbre[]; porCategoria: Array<GrupoIncertidumbre & { n: number }>; total: GrupoIncertidumbre; incidencias: string[] }

/**
 * Incertidumbre de un grupo de líneas. El error del dato de actividad es independiente entre líneas (cada factura se mide por separado), pero el del factor de emisión es el MISMO
 * en todas las líneas de una misma fuente (un único mix eléctrico, un único factor del gas): se suma linealmente dentro de la fuente y solo se combina en cuadratura entre fuentes.
 * Tratar el factor como independiente entre facturas lo diluiría artificialmente (15 facturas de luz darían un 1,8 % en vez de un 5 %).
 */
const agrupar = (nombre: string, ls: IncertidumbreLinea[], c: ConfigIncertidumbre): GrupoIncertidumbre => {
  const emision = ls.reduce((t, x) => t + x.emision, 0);
  const varDato = new Map<string, number>(), sumFactor = new Map<string, number>();
  for (const x of ls) { varDato.set(x.fuente, (varDato.get(x.fuente) ?? 0) + x.absDato ** 2); sumFactor.set(x.fuente, (sumFactor.get(x.fuente) ?? 0) + x.absFactor); }
  const porFuente = new Map<string, number>();
  for (const k of new Set([...varDato.keys(), ...sumFactor.keys()])) porFuente.set(k, (varDato.get(k) ?? 0) + (sumFactor.get(k) ?? 0) ** 2);
  const varianza = [...porFuente.values()].reduce((t, v) => t + v, 0);
  const absoluta = Math.sqrt(varianza);
  const pct = emision > 0 ? (absoluta / emision) * 100 : null;
  const top = [...porFuente.entries()].sort((a, b) => b[1] - a[1])[0];
  return { nombre, emision, absoluta, pct, valoracion: valoracion(pct, c), principal: top && varianza > 0 ? { fuente: top[0], peso: (top[1] / varianza) * 100 } : null };
};

/** Combina por fuente, categoría y total (raíz de la suma de cuadrados). Los ajustes de una línea sin justificación son una incidencia. */
export function calcularIncertidumbre(resultados: ResultadoLinea[], f: ConjuntoFactores, cfgParcial?: Partial<ConfigIncertidumbre> | null): ResultadoIncertidumbre {
  const cfg = configIncertidumbre(cfgParcial);
  const lineas = resultados.map((r) => incertidumbreLinea(r, f, cfg));
  const incidencias = lineas.filter((x) => x.ajustada && !x.justificacion).map((x) => `La línea «${x.fuente}» tiene la incertidumbre ajustada sin justificación.`);
  const nombresFuente = [...new Set(lineas.map((x) => x.fuente))].sort();
  const porFuente = nombresFuente.map((n) => agrupar(n, lineas.filter((x) => x.fuente === n), cfg));
  const cats = [...new Set(lineas.map((x) => x.categoria))].sort();
  const porCategoria = cats.map((n) => ({ n, ...agrupar(`Categoría ${n}`, lineas.filter((x) => x.categoria === n), cfg) }));
  return { lineas, porFuente, porCategoria, total: agrupar('Total', lineas, cfg), incidencias };
}

export interface FilaIncertidumbreFuente { fuente: string; emision: number; consumo: string; factor: string; pct: number | null }
/**
 * Describe, para cada fuente, SOLO lo que se ha aplicado en este inventario: el origen del consumo (factura, parte de mantenimiento…) con su margen
 * y el factor que pesa (mix eléctrico, CO₂ del combustible, PCA de la mezcla…) con el suyo. No incluye valores del catálogo que no se usen.
 */
export function descripcionPorFuente(resultados: ResultadoLinea[], inc: ResultadoIncertidumbre): FilaIncertidumbreFuente[] {
  const catPorId = new Map(resultados.map((r) => [r.linea.id, r.linea]));
  const pct = (v: number) => `±${fmt(v, 'porcentaje')} %`;
  const rango = (v: number[]) => { const r = v.map((x) => Math.round(x * 10) / 10); const mn = Math.min(...r), mx = Math.max(...r); return mn === mx ? pct(mn) : `${pct(mn)} a ${pct(mx)}`; };
  return inc.porFuente.map((g) => {
    const todas = inc.lineas.filter((l) => l.fuente === g.nombre);
    const ls = todas.some((l) => l.emision > 0) ? todas.filter((l) => l.emision > 0) : todas; // las líneas sin consumo no aportan margen
    const origenes = [...new Set(ls.map((l) => ORIGENES_DATO[l.origen].toLowerCase()))].join(' y ');
    const l0 = catPorId.get(ls[0]?.id ?? '');
    const factor = !l0 ? 'factor de emisión' : l0.categoria === 'electricidad' ? 'mix eléctrico' : l0.categoria === 'fugitiva' ? (esMezclaRefrigerante(l0.fuente) ? 'PCA de la mezcla' : 'PCA del gas') : 'CO₂ del combustible';
    return { fuente: g.nombre, emision: g.emision / 1000, consumo: ls.length ? `${rango(ls.map((l) => l.datoPct))} · ${origenes}` : '—', factor: ls.length ? `${rango(ls.map((l) => l.factorPct))} · ${factor}` : '—', pct: g.pct };
  });
}
