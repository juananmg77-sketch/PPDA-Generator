// Resumen ejecutivo del informe: cifras clave y tres conclusiones generadas por reglas (con umbrales configurables).
import { fmt } from './formato.ts';

export interface ConfigResumen { /** % del total a partir del cual una fuente se destaca. */ fuentePct: number; /** % de variación frente al año base a partir del cual se destaca. */ variacionPct: number; conclusiones: number }
export const CONFIG_RESUMEN_POR_DEFECTO: ConfigResumen = { fuentePct: 25, variacionPct: 15, conclusiones: 3 };
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
}
export interface FuentePrincipal { fuente: string; t: number; pct: number }

export function fuentesPrincipales(porFuente: Record<string, number>, total: number, n = 5): FuentePrincipal[] {
  return Object.entries(porFuente).filter(([, t]) => t > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([fuente, t]) => ({ fuente, t, pct: total > 0 ? (t / total) * 100 : 0 }));
}

/** Conclusiones por reglas, en orden de prioridad; las últimas (hechos) garantizan que siempre hay las pedidas. */
export function conclusiones(e: EntradaResumen, cfgP?: Partial<ConfigResumen> | null): string[] {
  const cfg = configResumen(cfgP);
  const top = fuentesPrincipales(e.porFuente, e.total, 1)[0];
  const reglas: Array<() => string | null> = [
    () => (top && top.pct > cfg.fuentePct ? `La fuente «${top.fuente}» concentra el ${fmt(top.pct, 'porcentaje')} % de las emisiones (umbral de atención: ${fmt(cfg.fuentePct, 'porcentaje')} %).` : null),
    () => (e.variacion?.pct != null && Math.abs(e.variacion.pct) > cfg.variacionPct ? `Las emisiones ${e.variacion.pct > 0 ? 'aumentan' : 'disminuyen'} un ${fmt(Math.abs(e.variacion.pct), 'porcentaje')} % respecto al ${e.variacion.tipo === 'base' ? 'año base' : 'año anterior'} (${e.variacion.anioRef}).` : null),
    () => (e.incertidumbre.pct != null && (e.incertidumbre.valoracion === 'Alta' || e.incertidumbre.valoracion === 'Muy alta') ? `La incertidumbre combinada es ${e.incertidumbre.valoracion.toLowerCase()} (±${fmt(e.incertidumbre.pct, 'porcentaje')} %)${e.incertidumbre.principal ? `, con «${e.incertidumbre.principal}» como principal contribuyente` : ''}.` : null),
    () => (e.total > 0 && e.cat2 / e.total > 0.5 ? `La energía importada (categoría 2) supone el ${fmt((e.cat2 / e.total) * 100, 'porcentaje')} % del total.` : null),
    () => (e.pendientes > 0 ? `Quedan ${e.pendientes} pendiente(s) por resolver antes de la versión final.` : null),
    // Hechos: siempre disponibles
    () => `El inventario ${e.anio} cuantifica ${fmt(e.total, 'tCO2e')} t CO₂e: ${fmt(e.cat1, 'tCO2e')} t de emisiones directas y ${fmt(e.cat2, 'tCO2e')} t de energía importada.`,
    () => (e.ratioEstancia != null ? `La intensidad es de ${fmt(e.ratioEstancia, 'ratio')} t CO₂e por estancia${e.ratioTrabajador != null ? ` y ${fmt(e.ratioTrabajador, 'ratio')} t CO₂e por trabajador` : ''}.` : e.ratioTrabajador != null ? `La intensidad es de ${fmt(e.ratioTrabajador, 'ratio')} t CO₂e por trabajador.` : null),
    () => (top ? `La principal fuente es «${top.fuente}» (${fmt(top.pct, 'porcentaje')} % del total).` : null),
  ];
  const out: string[] = [];
  for (const r of reglas) { const t = r(); if (t && !out.includes(t)) out.push(t); if (out.length >= cfg.conclusiones) break; }
  return out;
}
