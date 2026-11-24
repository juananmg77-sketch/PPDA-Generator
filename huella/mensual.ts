// Utilidades de periodos: reparto mensual de un consumo y meses cubiertos por un conjunto de facturas.

const fecha = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s.slice(0, 10) + 'T00:00:00Z') : null);
const DIA = 86400000;

/**
 * Reparte `cantidad` entre los 12 meses de `anio` en proporción a los días del periodo que caen en cada mes.
 * Devuelve también lo que queda fuera del año (periodos que cruzan de año) y si no se pudo repartir (sin periodo válido).
 */
export function repartirPorMes(desde: string | null | undefined, hasta: string | null | undefined, cantidad: number, anio: number, incluirFuera = false): { meses: number[]; fueraDeAnio: number; sinPeriodo: boolean } {
  const meses = Array(12).fill(0);
  const d = fecha(desde);
  const h = fecha(hasta ?? desde);
  if (!d || !h || h < d) return { meses, fueraDeAnio: 0, sinPeriodo: true };
  const total = Math.round((h.getTime() - d.getTime()) / DIA) + 1;
  let dentro = 0;
  for (let t = d.getTime(); t <= h.getTime(); t += DIA) {
    const x = new Date(t);
    if (x.getUTCFullYear() === anio) { meses[x.getUTCMonth()] += cantidad / total; dentro += 1; }
  }
  const fuera = cantidad * (1 - dentro / total);
  // El cálculo cuenta cada factura entera. Con `incluirFuera`, la parte de un periodo que cruza de año se asigna al mes del extremo (enero si empieza antes, diciembre si acaba después)
  // para que los gráficos y totales coincidan con las tablas y con el cálculo.
  if (incluirFuera && fuera > 0 && dentro > 0) meses[d.getUTCFullYear() < anio ? 0 : 11] += fuera;
  return { meses, fueraDeAnio: fuera, sinPeriodo: false };
}

/** Meses (0-11) del año en los que el periodo tiene al menos un día. */
export function mesesTocados(desde: string | null | undefined, hasta: string | null | undefined, anio: number): number[] {
  const d = fecha(desde);
  const h = fecha(hasta ?? desde);
  if (!d || !h || h < d) return [];
  const out = new Set<number>();
  for (let t = d.getTime(); t <= h.getTime(); t += DIA) {
    const x = new Date(t);
    if (x.getUTCFullYear() === anio) out.add(x.getUTCMonth());
  }
  return [...out].sort((a, b) => a - b);
}

export const NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Agrupa elementos por tipo y por contador (CUPS); los sin contador van a la clave «sin contador». */
export function agruparPorTipoYContador<T>(items: T[], tipo: (x: T) => string, contador: (x: T) => string | undefined | null): Array<{ tipo: string; contador: string; items: T[] }> {
  const m = new Map<string, { tipo: string; contador: string; items: T[] }>();
  for (const x of items) {
    const t = tipo(x) || 'otro';
    const c = (contador(x) ?? '').trim() || 'sin contador';
    const k = `${t}\u0000${c}`;
    if (!m.has(k)) m.set(k, { tipo: t, contador: c, items: [] });
    m.get(k)!.items.push(x);
  }
  return [...m.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.contador.localeCompare(b.contador));
}

/**
 * Mes y año de facturación de un periodo: el mes que contiene más días del periodo (en empate, el posterior).
 * Ej.: 31/12/2023 → 31/01/2024 = «Ene 2024»; 20/03 → 22/04 = «Abr 2024». Un periodo de un solo día da su mes.
 */
export function mesFacturacion(desde: string | null | undefined, hasta: string | null | undefined): string | null {
  const d = fecha(desde ?? hasta);
  const h = fecha(hasta ?? desde);
  if (!d || !h || h < d) return null;
  const dias = new Map<string, number>();
  for (let t = d.getTime(); t <= h.getTime(); t += DIA) { const x = new Date(t); const k = `${x.getUTCFullYear()}-${String(x.getUTCMonth()).padStart(2, '0')}`; dias.set(k, (dias.get(k) ?? 0) + 1); }
  const [k] = [...dias.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0];
  const [y, m] = k.split('-');
  const nombre = NOMBRES_MES[Number(m)];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${y}`;
}
