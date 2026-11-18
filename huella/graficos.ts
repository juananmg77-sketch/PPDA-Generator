// Gráficos del informe como SVG (texto puro, sin dependencias): se incrustan tal cual en el HTML/PDF y se convierten a PNG para el Word.
import { repartirPorMes } from './mensual.ts';

export const PALETA = ['#00BF46', '#0002C9', '#EA980F', '#24CBF5', '#C234D6', '#F9416D', '#77D464', '#00093D'];
const TEXTO = '#333333', SUAVE = '#777777', EJE = '#9D9D9C', REJILLA = '#E5E5E5';
const FUENTE = "Montserrat, Arial, sans-serif";
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const nf = (v: number, d = 2) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const px = (n: number) => Math.round(n * 10) / 10;

/** Nombre corto de la fuente para leyendas: «Gas butano (kg)» → «Gas butano»; sin fuente = electricidad. */
export const etiquetaFuente = (fuente?: string | null) => (fuente ? fuente.replace(/\s*\([^)]*\)\**/g, '').replace(/\*+$/, '').trim() : 'Electricidad');

/** Reparte las emisiones de cada línea por meses del año (t CO₂e) en proporción a los días de su periodo; serie por fuente. */
export function emisionesMensuales(items: Array<{ fuente?: string | null; kgCO2e: number; desde?: string | null; hasta?: string | null }>, anio: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const it of items) {
    const r = repartirPorMes(it.desde, it.hasta, it.kgCO2e / 1000, anio);
    if (r.sinPeriodo) continue;
    const k = etiquetaFuente(it.fuente);
    out[k] = out[k] ?? Array(12).fill(0);
    r.meses.forEach((v, i) => { out[k][i] += v; });
  }
  return out;
}

/** Marcas «redondas» para un eje que llega hasta `max`. */
function marcas(max: number, n = 4): { tope: number; ticks: number[] } {
  if (!(max > 0)) return { tope: 1, ticks: [0, 1] };
  const bruto = max / n;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot;
  const tope = Math.ceil(max / paso) * paso;
  const ticks: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) ticks.push(Math.round(v * 1e6) / 1e6);
  return { tope, ticks };
}

const abre = (w: number, h: number, titulo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FUENTE}" role="img" aria-label="${esc(titulo)}"><title>${esc(titulo)}</title><rect width="${w}" height="${h}" fill="#ffffff"/>`;

export interface Grafico { svg: string; ancho: number; alto: number }

/** Anillo de reparto: datos en t CO₂e; el total va en el centro y la leyenda a la derecha. */
export function svgAnillo(datos: Array<{ nombre: string; t: number }>, titulo: string): Grafico {
  const W = 640, H = 280, cx = 140, cy = 140, R = 105, r = 64;
  const util = datos.filter((d) => d.t > 0).sort((a, b) => b.t - a.t);
  const total = util.reduce((s, d) => s + d.t, 0);
  let s = abre(W, H, titulo);
  if (util.length === 0 || total <= 0) return { svg: s + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${SUAVE}" font-size="14">Sin datos</text></svg>`, ancho: W, alto: H };
  let ang = -Math.PI / 2;
  util.forEach((d, i) => {
    const frac = d.t / total;
    const a2 = ang + frac * Math.PI * 2;
    const color = PALETA[i % PALETA.length];
    if (frac > 0.9999) s += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${color}" stroke-width="${R - r}"/>`;
    else {
      const gran = a2 - ang > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${px(cx + rad * Math.cos(a))} ${px(cy + rad * Math.sin(a))}`;
      s += `<path d="M ${p(R, ang)} A ${R} ${R} 0 ${gran} 1 ${p(R, a2)} L ${p(r, a2)} A ${r} ${r} 0 ${gran} 0 ${p(r, ang)} Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>`;
    }
    ang = a2;
  });
  s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="${TEXTO}" font-size="22" font-weight="700">${nf(total, 1)}</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="${SUAVE}" font-size="11">t CO₂e</text>`;
  const x0 = 290; let y = 40;
  util.slice(0, 8).forEach((d, i) => {
    s += `<rect x="${x0}" y="${y - 11}" width="12" height="12" rx="2" fill="${PALETA[i % PALETA.length]}"/>`
      + `<text x="${x0 + 20}" y="${y}" fill="${TEXTO}" font-size="12">${esc(d.nombre)}</text>`
      + `<text x="${W - 14}" y="${y}" text-anchor="end" fill="${TEXTO}" font-size="12" font-weight="600">${nf(d.t, 1)} t · ${nf((d.t / total) * 100, 1)} %</text>`;
    y += 26;
  });
  return { svg: s + '</svg>', ancho: W, alto: H };
}

/** Barras verticales apiladas por serie (p. ej. meses × fuentes), en t CO₂e. */
export function svgBarrasApiladas(categorias: string[], series: Array<{ nombre: string; valores: number[] }>, titulo: string, unidad = 't CO₂e'): Grafico {
  const W = 640, H = 300, izq = 52, der = 16, sup = 16, inf = series.length > 0 ? 64 : 44;
  const hz = W - izq - der, vt = H - sup - inf;
  const tot = categorias.map((_, i) => series.reduce((s, x) => s + (x.valores[i] ?? 0), 0));
  const { tope, ticks } = marcas(Math.max(...tot, 0));
  let s = abre(W, H, titulo);
  if (Math.max(...tot, 0) <= 0) return { svg: s + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${SUAVE}" font-size="14">Sin datos</text></svg>`, ancho: W, alto: H };
  const y = (v: number) => sup + vt - (v / tope) * vt;
  for (const t of ticks) s += `<line x1="${izq}" y1="${px(y(t))}" x2="${W - der}" y2="${px(y(t))}" stroke="${REJILLA}"/><text x="${izq - 6}" y="${px(y(t)) + 4}" text-anchor="end" fill="${SUAVE}" font-size="10">${nf(t, t < 10 && t % 1 ? 1 : 0)}</text>`;
  const bw = (hz / categorias.length) * 0.62;
  categorias.forEach((c, i) => {
    const x = izq + (hz / categorias.length) * i + (hz / categorias.length - bw) / 2;
    let acc = 0;
    series.forEach((ser, k) => {
      const v = ser.valores[i] ?? 0;
      if (v > 0) { const top = y(acc + v), alto = y(acc) - top; s += `<rect x="${px(x)}" y="${px(top)}" width="${px(bw)}" height="${px(alto)}" fill="${PALETA[k % PALETA.length]}"/>`; }
      acc += v;
    });
    s += `<text x="${px(x + bw / 2)}" y="${H - inf + 16}" text-anchor="middle" fill="${SUAVE}" font-size="10">${esc(c)}</text>`;
  });
  s += `<line x1="${izq}" y1="${sup + vt}" x2="${W - der}" y2="${sup + vt}" stroke="${EJE}"/>`;
  s += `<text x="${izq}" y="${sup - 4}" fill="${SUAVE}" font-size="10">${esc(unidad)}</text>`;
  let lx = izq; const ly = H - 18;
  series.forEach((ser, k) => { s += `<rect x="${lx}" y="${ly - 10}" width="11" height="11" rx="2" fill="${PALETA[k % PALETA.length]}"/><text x="${lx + 16}" y="${ly}" fill="${TEXTO}" font-size="11">${esc(ser.nombre)}</text>`; lx += 34 + ser.nombre.length * 6.4; });
  return { svg: s + '</svg>', ancho: W, alto: H };
}

/** Barras horizontales (p. ej. por centro), valores en t CO₂e con su etiqueta a la derecha. */
export function svgBarrasHorizontales(datos: Array<{ nombre: string; t: number }>, titulo: string, decimales = 2, unidad = 't'): Grafico {
  const util = [...datos].sort((a, b) => b.t - a.t).slice(0, 12);
  const fila = 28, W = 640, sup = 12, izq = 190, der = 90, H = Math.max(110, sup * 2 + util.length * fila);
  let s = abre(W, H, titulo);
  const max = Math.max(...util.map((d) => d.t), 0);
  if (max <= 0) return { svg: s + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${SUAVE}" font-size="14">Sin datos</text></svg>`, ancho: W, alto: H };
  util.forEach((d, i) => {
    const yy = sup + i * fila, ancho = ((W - izq - der) * d.t) / max;
    const nombre = d.nombre.length > 28 ? d.nombre.slice(0, 27) + '…' : d.nombre;
    s += `<text x="${izq - 8}" y="${yy + 16}" text-anchor="end" fill="${TEXTO}" font-size="11">${esc(nombre)}</text><rect x="${izq}" y="${yy + 4}" width="${px(Math.max(ancho, 1))}" height="16" rx="2" fill="${PALETA[0]}"/><text x="${px(izq + ancho + 6)}" y="${yy + 16}" fill="${TEXTO}" font-size="11" font-weight="600">${nf(d.t, decimales)} ${unidad}</text>`;
  });
  return { svg: s + '</svg>', ancho: W, alto: H };
}

/** Barras agrupadas: grupos (Alcance 1, Alcance 2, Total) × series (año anterior, año actual), en t CO₂e. */
export function svgBarrasAgrupadas(grupos: string[], series: Array<{ nombre: string; valores: number[] }>, titulo: string, unidad = 't CO₂e'): Grafico {
  const W = 640, H = 300, izq = 52, der = 16, sup = 22, inf = 56;
  const hz = W - izq - der, vt = H - sup - inf;
  const max = Math.max(...series.flatMap((x) => x.valores), 0);
  let s = abre(W, H, titulo);
  if (max <= 0) return { svg: s + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${SUAVE}" font-size="14">Sin datos</text></svg>`, ancho: W, alto: H };
  const { tope, ticks } = marcas(max);
  const y = (v: number) => sup + vt - (v / tope) * vt;
  for (const t of ticks) s += `<line x1="${izq}" y1="${px(y(t))}" x2="${W - der}" y2="${px(y(t))}" stroke="${REJILLA}"/><text x="${izq - 6}" y="${px(y(t)) + 4}" text-anchor="end" fill="${SUAVE}" font-size="10">${nf(t, t < 10 && t % 1 ? 1 : 0)}</text>`;
  const bloque = hz / grupos.length, bw = (bloque * 0.7) / series.length;
  grupos.forEach((g, i) => {
    const x0 = izq + bloque * i + bloque * 0.15;
    series.forEach((ser, k) => {
      const v = ser.valores[i] ?? 0, x = x0 + bw * k, top = y(v);
      s += `<rect x="${px(x)}" y="${px(top)}" width="${px(bw - 3)}" height="${px(y(0) - top)}" fill="${k === series.length - 1 ? PALETA[0] : '#B7C4D6'}"/><text x="${px(x + (bw - 3) / 2)}" y="${px(top - 4)}" text-anchor="middle" fill="${TEXTO}" font-size="10" font-weight="600">${nf(v, 1)}</text>`;
    });
    s += `<text x="${px(izq + bloque * i + bloque / 2)}" y="${H - inf + 16}" text-anchor="middle" fill="${TEXTO}" font-size="11">${esc(g)}</text>`;
  });
  s += `<line x1="${izq}" y1="${y(0)}" x2="${W - der}" y2="${y(0)}" stroke="${EJE}"/><text x="${izq}" y="${sup - 8}" fill="${SUAVE}" font-size="10">${esc(unidad)}</text>`;
  let lx = izq; const ly = H - 14;
  series.forEach((ser, k) => { s += `<rect x="${lx}" y="${ly - 10}" width="11" height="11" rx="2" fill="${k === series.length - 1 ? PALETA[0] : '#B7C4D6'}"/><text x="${lx + 16}" y="${ly}" fill="${TEXTO}" font-size="11">${esc(ser.nombre)}</text>`; lx += 40 + ser.nombre.length * 6.4; });
  return { svg: s + '</svg>', ancho: W, alto: H };
}

export const NOMBRES_MES = MESES;
