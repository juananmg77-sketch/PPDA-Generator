// Resumen ejecutivo del informe: cifras clave y tres conclusiones generadas por reglas (con umbrales configurables).
import { fmt } from './formato.ts';

export interface ConfigResumen { /** % del total a partir del cual una fuente se destaca. */ fuentePct: number; /** % de variación frente al año base a partir del cual se destaca. */ variacionPct: number; /** % de variación por debajo del cual se considera que se mantiene estable. */ establePct: number; conclusiones: number }
export const CONFIG_RESUMEN_POR_DEFECTO: ConfigResumen = { fuentePct: 25, variacionPct: 15, establePct: 5, conclusiones: 4 };
export const configResumen = (c?: Partial<ConfigResumen> | null): ConfigResumen => ({ ...CONFIG_RESUMEN_POR_DEFECTO, ...(c ?? {}) });

export interface EntradaResumen {
  anio: number; total: number; cat1: number; cat2: number;
  /** t CO₂e por fuente. */
  porFuente: Record<string, number>;
  ratioEstancia: number | null; ratioTrabajador: number | null;
  /** Variación (%) y año de referencia frente al año base; si no hay base, frente al anterior. */
  variacion: { pct: number | null; anioRef: number | null; tipo: 'base' | 'anterior' } | null;
  incertidumbre: { pct: number | null; valoracion: string | null; principal: string | null };
  pendientes: number;
  /** Año de referencia con sus cifras (año base; si no hay, el anterior). */
  ref?: { anio: number; tipo: 'base' | 'anterior'; total: number; ratioEstancia: number | null; ratioTrabajador: number | null } | null;
  /** Variación por tipo de fuente comparable con el año de referencia (solo tipos con emisiones en ambos años), t CO₂e. */
  cambiosFuente?: Array<{ fuente: string; actual: number; ref: number }>;
}
export interface FuentePrincipal { fuente: string; t: number; pct: number }

export function fuentesPrincipales(porFuente: Record<string, number>, total: number, n = 5): FuentePrincipal[] {
  return Object.entries(porFuente).filter(([, t]) => t > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([fuente, t]) => ({ fuente, t, pct: total > 0 ? (t / total) * 100 : 0 }));
}

/** Nombre de fuente legible en un texto: sin la unidad ni el asterisco de las notas («Gas natural (kWhPCS)*» → «Gas natural»). */
export const nombreLegible = (n: string) => n.replace(/\s*\((?:kWh ?PCS|kWh ?PCI|kWh|kg|l|m3|m³)\)\*{0,2}/gi, '').replace(/\*+$/, '').trim();
const pc = (v: number) => fmt(Math.abs(v), 'porcentaje');
const t = (v: number) => fmt(Math.abs(v), 'tCO2e');
/** Valoración de una variación porcentual: favorable si baja, desfavorable si sube, estable si cambia poco. */
export function valorarVariacion(pct: number, cfg: ConfigResumen): string {
  if (Math.abs(pct) <= cfg.establePct) return 'se mantiene estable (variación poco significativa)';
  const intensidad = Math.abs(pct) > cfg.variacionPct ? 'claramente ' : '';
  return pct < 0 ? `evolución ${intensidad}favorable` : `evolución ${intensidad}desfavorable`;
}

/**
 * Conclusiones del informe. Valoran siempre: evolución respecto al año base (o al anterior), fuentes de mayor a menor relevancia,
 * qué cambia más frente a ese año, intensidad y calidad del dato. Nada de avisos internos de la aplicación.
 */
export function conclusiones(e: EntradaResumen, cfgP?: Partial<ConfigResumen> | null): string[] {
  const cfg = configResumen(cfgP);
  const out: string[] = [];
  const nombreRef = e.ref ? (e.ref.tipo === 'base' ? `al año base (${e.ref.anio})` : `al año anterior (${e.ref.anio})`) : null;

  // 1. Evolución
  if (e.ref && e.ref.total > 0) {
    const d = e.total - e.ref.total; const pct = (d / e.ref.total) * 100;
    out.push(`Evolución: en ${e.anio} se emiten ${fmt(e.total, 'tCO2e')} t CO₂e (${fmt(e.cat1, 'tCO2e')} t directas y ${fmt(e.cat2, 'tCO2e')} t de energía importada). Frente ${e.ref.tipo === 'base' ? 'al año base' : 'al año anterior'} (${e.ref.anio}: ${fmt(e.ref.total, 'tCO2e')} t) ${d >= 0 ? 'suben' : 'bajan'} ${t(d)} t (${d >= 0 ? '+' : '−'}${pc(pct)} %): ${valorarVariacion(pct, cfg)}.`);
  } else {
    out.push(`Evolución: en ${e.anio} se emiten ${fmt(e.total, 'tCO2e')} t CO₂e (${fmt(e.cat1, 'tCO2e')} t directas y ${fmt(e.cat2, 'tCO2e')} t de energía importada). No hay año base ni año anterior con que compararlas, así que no puede valorarse su evolución: defina el año base para poder hacerlo.`);
  }

  // 2. Fuentes de mayor a menor relevancia
  const principales = fuentesPrincipales(e.porFuente, e.total, 4);
  if (principales.length) {
    const lista = principales.map((f) => `${nombreLegible(f.fuente)} (${fmt(f.pct, 'porcentaje')} %, ${fmt(f.t, 'tCO2e')} t)`).join('; ');
    const top = principales[0];
    out.push(`Fuentes más relevantes, de mayor a menor: ${lista}.${top.pct > cfg.fuentePct ? ` «${nombreLegible(top.fuente)}» supera el umbral de atención del ${fmt(cfg.fuentePct, 'porcentaje')} %: es donde más puede reducirse.` : ''}`);
  }

  // 3. Qué cambia más frente al año de referencia (solo fuentes comparables; las que solo existen en un año se citan aparte, sin porcentaje)
  if (nombreRef) {
    const todas = e.cambiosFuente ?? [];
    const c = todas.filter((x) => x.ref > 0 && x.actual > 0).map((x) => ({ ...x, d: x.actual - x.ref, pct: ((x.actual - x.ref) / x.ref) * 100 }));
    const sube = [...c].filter((x) => x.d > 0).sort((a, b) => b.d - a.d)[0];
    const baja = [...c].filter((x) => x.d < 0).sort((a, b) => a.d - b.d)[0];
    const partes: string[] = [];
    if (sube) partes.push(`la que más aumenta es «${nombreLegible(sube.fuente)}» (+${t(sube.d)} t, +${pc(sube.pct)} %)`);
    if (baja) partes.push(`la que más disminuye es «${nombreLegible(baja.fuente)}» (−${t(baja.d)} t, −${pc(baja.pct)} %)`);
    const sin = todas.filter((x) => (x.ref > 0) !== (x.actual > 0)).map((x) => (x.ref > 0 ? `«${nombreLegible(x.fuente)}» no registra emisiones en ${e.anio} (${t(x.ref)} t en ${e.ref!.anio})` : `«${nombreLegible(x.fuente)}» aparece en ${e.anio} (${t(x.actual)} t) y no figuraba en ${e.ref!.anio}`));
    const base = partes.length ? `Por fuentes, frente ${nombreRef}: ${partes.join(' y ')}.` : `Por fuentes, frente ${nombreRef} no hay variaciones apreciables entre fuentes comparables.`;
    out.push(`${base}${sin.length ? ` Sin comparación posible: ${sin.join('; ')}.` : ''}`);
  }

  // Calidad del dato: solo se destaca si la incertidumbre es alta (el detalle está en el apartado de incertidumbre)
  if (e.incertidumbre.pct != null && (e.incertidumbre.valoracion === 'Alta' || e.incertidumbre.valoracion === 'Muy alta')) out.push(`Calidad del dato: la incertidumbre combinada es ${e.incertidumbre.valoracion.toLowerCase()} (±${fmt(e.incertidumbre.pct, 'porcentaje')} %)${e.incertidumbre.principal ? `; la fuente que más aporta es «${nombreLegible(e.incertidumbre.principal)}»` : ''}: conviene mejorar su medición.`);

  // Intensidad
  const ints: string[] = [];
  const intensidad = (nombre: string, v: number | null, r: number | null | undefined) => {
    if (v == null) return;
    if (r != null && r > 0) { const p = ((v - r) / r) * 100; ints.push(`${fmt(v, 'ratio')} t CO₂e por ${nombre} (${fmt(r, 'ratio')} en ${e.ref!.anio}; ${p >= 0 ? '+' : '−'}${pc(p)} %, ${Math.abs(p) <= cfg.establePct ? 'estable' : p < 0 ? 'mejora' : 'empeora'})`); } else ints.push(`${fmt(v, 'ratio')} t CO₂e por ${nombre}`);
  };
  intensidad('estancia', e.ratioEstancia, e.ref?.ratioEstancia);
  intensidad('trabajador', e.ratioTrabajador, e.ref?.ratioTrabajador);
  if (ints.length) out.push(`Intensidad: ${ints.join('; ')}.`);

  return out.slice(0, Math.max(cfg.conclusiones, 1));
}
