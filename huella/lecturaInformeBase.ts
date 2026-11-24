// Lectura con IA del informe de huella del año base (PDF): propone los datos del año base para que la persona los revise. Nunca guarda nada.
import type { ResumenAnio } from './anioBase.ts';

export interface LecturaInformeBase {
  anio: number | null;
  organizacion: string | null;
  /** Unidad en que el informe expresa las emisiones: se convierte a toneladas. */
  unidad: 't' | 'kg' | null;
  categoria1: number | null;
  categoria2: number | null;
  total: number | null;
  estancias: number | null;
  plantilla: number | null;
  /** Conjunto de factores o versión de la calculadora citados en el informe. */
  factores: string | null;
  centros: string[];
  porFuente: Array<{ fuente: string; emisiones: number }>;
  verificador: string | null;
  referenciaVerificacion: string | null;
  /** Página del informe donde figura el total (para comprobarlo). */
  paginaTotal: number | null;
  observaciones: string | null;
}

// Esquema de salida: tipos simples y propiedades opcionales (lo que no consta, se omite), que es lo que admite la salida estructurada.
export const ESQUEMA_INFORME_BASE = {
  type: 'object', additionalProperties: false,
  required: ['centros', 'porFuente'],
  properties: {
    anio: { type: 'integer', description: 'Año del inventario' }, organizacion: { type: 'string' }, unidad: { type: 'string', enum: ['t', 'kg'] },
    categoria1: { type: 'number' }, categoria2: { type: 'number' }, total: { type: 'number' }, estancias: { type: 'number' }, plantilla: { type: 'number' }, factores: { type: 'string' },
    centros: { type: 'array', items: { type: 'string' } },
    porFuente: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['fuente', 'emisiones'], properties: { fuente: { type: 'string' }, emisiones: { type: 'number' } } } },
    verificador: { type: 'string' }, referenciaVerificacion: { type: 'string' }, paginaTotal: { type: 'integer' }, observaciones: { type: 'string' },
  },
} as const;

export const INSTRUCCIONES_INFORME_BASE = `Lees el informe de un inventario de gases de efecto invernadero (ISO 14064-1, huella de carbono) de un año anterior, que se usará como AÑO BASE. Extrae solo lo que figure en el documento; si un dato no consta, devuélvelo null. No inventes ni deduzcas cifras que no se vean.
- anio: el año del inventario (el periodo que cubre), no el de emisión del informe.
- unidad: la unidad en que el informe da las emisiones totales (t CO2e o kg CO2e). Devuelve las emisiones tal como figuran y en «unidad» indica «t» o «kg».
- categoria1: emisiones directas (categoría 1 / Alcance 1). categoria2: energía importada (categoría 2 / Alcance 2; si hay método de ubicación y de mercado, usa el de ubicación salvo que el informe indique otro como principal). total: total del inventario cuantificado (categorías 1 y 2, o el total que declare el informe).
- estancias: número de estancias (pernoctaciones) del año; plantilla: plantilla media. Solo si constan.
- factores: el conjunto de factores o la versión de la calculadora citados (p. ej. «Calculadora del Govern 2023.2», «MITECO v17»).
- centros: nombres de los centros o establecimientos incluidos en el inventario.
- porFuente: emisiones de cada fuente (en la misma unidad), una fila por fuente, solo si el informe las desglosa; no incluyas totales ni subtotales.
- verificador y referenciaVerificacion: entidad verificadora y referencia o número de su informe, si constan.
- paginaTotal: página (empezando en 1) donde aparece el total.
- observaciones: una frase con lo que no hayas podido leer o lo que dudes.`;

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);

/** Un texto que la lectura devuelve como «null», «no consta», «N/A»… no es un dato. */
const txt = (x: string | null | undefined, max: number): string | null => { const t = x?.trim(); return !t || /^(null|n\/a|na|no consta|ninguno|ninguna|—|-)$/i.test(t) ? null : t.slice(0, max); };
export function limpiarLecturaBase(l: LecturaInformeBase): LecturaInformeBase {
  return {
    anio: typeof l.anio === 'number' && l.anio >= 2007 && l.anio <= 2100 ? l.anio : null,
    organizacion: txt(l.organizacion, 200), unidad: l.unidad === 'kg' || l.unidad === 't' ? l.unidad : null,
    categoria1: num(l.categoria1), categoria2: num(l.categoria2), total: num(l.total), estancias: num(l.estancias), plantilla: num(l.plantilla),
    factores: txt(l.factores, 400), centros: (l.centros ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 100),
    porFuente: (l.porFuente ?? []).filter((x) => x.fuente?.trim() && num(x.emisiones) != null),
    verificador: txt(l.verificador, 200), referenciaVerificacion: txt(l.referenciaVerificacion, 200),
    paginaTotal: typeof l.paginaTotal === 'number' && l.paginaTotal > 0 ? l.paginaTotal : null, observaciones: l.observaciones?.slice(0, 500) ?? null,
  };
}

/** Propuesta de datos del año base (en toneladas de CO₂e) a partir de la lectura. El total coherente: si falta, se suma; si no cuadra, se avisa. */
export function resumenDeLectura(l: LecturaInformeBase): { resumen: ResumenAnio | null; avisos: string[] } {
  const k = l.unidad === 'kg' ? 1 / 1000 : 1;
  const c1 = l.categoria1 == null ? null : l.categoria1 * k, c2 = l.categoria2 == null ? null : l.categoria2 * k;
  const avisos: string[] = [];
  let total = l.total == null ? null : l.total * k;
  if (total == null && c1 != null && c2 != null) { total = c1 + c2; avisos.push('El informe no da el total: se ha sumado de las categorías 1 y 2.'); }
  if (total != null && c1 != null && c2 != null && Math.abs(c1 + c2 - total) > Math.max(0.01 * total, 0.01)) avisos.push('Las categorías 1 y 2 no suman el total del informe: compruébelo.');
  const fuentes = l.porFuente.reduce((s, x) => s + x.emisiones * k, 0);
  if (total != null && fuentes > 0 && Math.abs(fuentes - total) > Math.max(0.05, 0.0005 * total)) avisos.push(`Las fuentes del informe suman ${fuentes.toLocaleString('es-ES', { maximumFractionDigits: 2 })} t y el total es ${total.toLocaleString('es-ES', { maximumFractionDigits: 2 })} t: compruebe cuál es correcto.`);
  if (l.anio == null) avisos.push('No se ha podido leer el año del inventario.');
  if (l.unidad == null && (l.total != null || l.categoria1 != null)) avisos.push('No consta la unidad de las emisiones: se han tomado como toneladas.');
  if (total == null) return { resumen: null, avisos: [...avisos, 'No se ha podido leer el total de emisiones.'] };
  return {
    avisos,
    resumen: {
      anio: l.anio ?? 0, porCategoria: { 1: c1 ?? 0, 2: c2 ?? 0 }, total,
      porFuente: Object.fromEntries(l.porFuente.map((x) => [x.fuente.trim(), x.emisiones * k])),
      estancias: l.estancias, plantilla: l.plantilla, factoresId: l.factores, centros: l.centros.length ? l.centros : null, factores: null,
    },
  };
}
